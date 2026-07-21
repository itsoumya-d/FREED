package app.freed.protection

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.VpnService
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import app.freed.protection.FreedDoomscrollApps.INSTAGRAM_PACKAGE
import app.freed.protection.FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
import app.freed.protection.FreedDoomscrollApps.YOUTUBE_PACKAGE
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.Date
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.TimeUnit

private const val PHOTO_MATCH_MIN_CONFIDENCE = 0.45
private const val FREED_APP_HOST_SUFFIX = ".app.freed.local"
private const val PENDING_INTERVENTION_MAX_AGE_MS = 10 * 60 * 1000L
private const val PENDING_INTERVENTION_FUTURE_SKEW_MS = 60 * 1000L
private const val PENDING_CONSUMED_INTERVENTION_IDS = "pending_consumed_intervention_ids_v1"
private const val MAX_PENDING_CONSUMED_INTERVENTION_IDS = 32
private const val ACTION_ACCESSIBILITY_DETAILS_SETTINGS = "android.settings.ACCESSIBILITY_DETAILS_SETTINGS"
private const val ACTION_PRIVATE_DNS_SETTINGS = "android.settings.PRIVATE_DNS_SETTINGS"
private const val INTENT_CATEGORY_USAGE_ACCESS_CONFIG = "android.intent.category.USAGE_ACCESS_CONFIG"
private const val ANDROID_SETTINGS_ROUTE_OPENED = "freed_android_settings_route_opened"
private const val ANDROID_SETTINGS_ROUTE_COMPONENT = "freed_android_settings_route_component"
private const val ANDROID_SETTINGS_ROUTE_FALLBACK_USED = "freed_android_settings_route_fallback_used"
private const val ANDROID_SETTINGS_ROUTE_ERROR = "freed_android_settings_route_error"
private const val ANDROID_SETTINGS_ROUTE_OPENED_AT = "freed_android_settings_route_opened_at"

class FreedProtectionModule : Module() {
  private val pendingInterventionClaimLock = Any()

  override fun definition() = ModuleDefinition {
    Name("FreedProtection")

    AsyncFunction("getCapabilities") {
      mapOf(
        "platform" to "android",
        "screenTime" to false,
        "managedSettings" to false,
        "accessibility" to true,
        "dnsFiltering" to true,
        "usageStats" to true,
        "localVpnFallback" to true,
        "notes" to listOf(
          "Accessibility service observes supported browser and focused WebView URL/search text only.",
          "Usage Access lets FREED cross-check selected app timers without reading in-app content.",
          "Configured app packages can be interrupted by Accessibility and UsageStats when the user opts in.",
          "Private DNS state is reported for QA because strict Private DNS can affect DNS Guard resolver behavior.",
          "Local VpnService fallback routes only configured DNS resolver IPs and never proxies full traffic."
        )
      )
    }

    AsyncFunction("getStatus") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val enabled = isAccessibilityServiceEnabled(context)
      val vpnActive = FreedVpnService.isRunning
      val activeUnlockExpiresAt = activeEarnedUnlockExpiresAt(context)
      val activeUnlockSourcePackage = activeUnlockSourcePackage(context)
      val privateDnsMode = getPrivateDnsMode(context)
      val privateDnsSpecifier = getPrivateDnsSpecifier(context)
      val usageStatsAuthorized = isUsageStatsAuthorized(context)
      val usageStatsSnapshot = queryConfiguredUsageStats(context)
      val dnsGuardUserEnabled = FreedVpnService.isUserEnabled(context)
      val dnsGuardAutoRestartEligible = FreedVpnService.isAutoRestartEligible(context)
      val vpnConsentRequired = isVpnConsentRequired(context)
      val lastSettingsRoute = lastAndroidSettingsRoute(context)
      val focusShieldSnapshot = FreedFocusShieldRules.snapshot(context)

      statusPayload(
        authorized = enabled || vpnActive || dnsGuardAutoRestartEligible,
        active = enabled || vpnActive,
        mode = if (enabled) "accessibility" else "dns",
        message = protectionStatusMessage(
          enabled,
          vpnActive,
          privateDnsMode,
          dnsGuardUserEnabled,
          dnsGuardAutoRestartEligible,
          vpnConsentRequired
        ),
        adultFilterActive = vpnActive,
        appInterventionAuthorized = enabled,
        usageStatsAuthorized = usageStatsAuthorized,
        usageStatsObservedPackages = usageStatsSnapshot?.observedPackages,
        usageStatsObservedPackageNames = usageStatsSnapshot?.observedPackageNames,
        usageStatsTodayMinutes = usageStatsSnapshot?.todayMinutes,
        usageStatsTodayMinutesByPackage = usageStatsSnapshot?.todayMinutesByPackage,
        blockedApplications = blockedApplicationCount(context),
        dailyLimitMinutes = configuredDailyLimitMinutes(context),
        shortFormInterruptionSeconds = configuredShortFormThresholdSeconds(context),
        focusShieldRuleCount = focusShieldSnapshot.rules.size,
        focusShieldEnabledRuleCount = focusShieldSnapshot.enabledCount,
        focusShieldRuleStoreHealth = focusShieldSnapshot.health,
        activeFocusShieldUnlockExpiresAt = FreedFocusShieldRules.activeSurfaceUnlockExpiresAt(context),
        activeFocusShieldUnlockRuleId = FreedFocusShieldRules.activeSurfaceUnlockRuleId(context),
        activeFocusShieldUnlockPackageName = FreedFocusShieldRules.activeSurfaceUnlockPackage(context),
        activeUnlockExpiresAt = activeUnlockExpiresAt,
        activeUnlockSourcePackage = activeUnlockSourcePackage,
        vpnConsentRequired = vpnConsentRequired,
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = lastSettingsRoute?.openedAction,
        androidSettingsRouteComponent = lastSettingsRoute?.openedComponent,
        androidSettingsRouteLabel = lastSettingsRoute?.let { androidSettingsRouteLabel(it.openedAction) },
        androidSettingsRouteInstruction = lastSettingsRoute?.let { androidSettingsRouteInstruction(it.openedAction, it.fallbackUsed) },
        androidSettingsFallbackUsed = lastSettingsRoute?.fallbackUsed,
        androidSettingsRouteError = lastSettingsRoute?.error,
        androidSettingsRouteOpenedAt = lastSettingsRoute?.openedAt,
        androidNotificationPermissionRequired = isAndroidNotificationPermissionRequired(),
        androidNotificationPermissionGranted = isAndroidNotificationPermissionGranted(context),
        androidUsageAccessConfigActivity = usageAccessConfigActivityName(context),
        androidUsageAccessReason = context.getString(R.string.freed_usage_access_reason),
        privateDnsMode = privateDnsMode,
        privateDnsSpecifier = privateDnsSpecifier,
        dnsGuardResolverCount = FreedVpnService.DNS_RESOLVERS.size,
        dnsGuardLastResolver = FreedVpnService.lastForwardResolver,
        dnsGuardLastForwardFailure = FreedVpnService.lastForwardFailure,
        dnsGuardStartedAtElapsedMs = FreedVpnService.dnsGuardStartedAtElapsedMs,
        dnsGuardUptimeMs = FreedVpnService.dnsGuardUptimeMs,
        dnsGuardLastStopReason = FreedVpnService.dnsGuardLastStopReason,
        dnsGuardLastSessionDurationMs = FreedVpnService.dnsGuardLastSessionDurationMs,
        dnsGuardStartCount = FreedVpnService.dnsGuardStartCount.get(),
        dnsGuardStopCount = FreedVpnService.dnsGuardStopCount.get(),
        dnsGuardPacketsRead = FreedVpnService.dnsGuardPacketsRead.get(),
        dnsGuardSessionQueries = FreedVpnService.dnsGuardSessionQueries.get(),
        dnsGuardAllowedQueries = FreedVpnService.dnsGuardAllowedQueries.get(),
        dnsGuardBlockedQueries = FreedVpnService.dnsGuardBlockedQueries.get(),
        dnsGuardServfailResponses = FreedVpnService.dnsGuardServfailResponses.get(),
        dnsGuardMalformedPackets = FreedVpnService.dnsGuardMalformedPackets.get(),
        dnsGuardRuntimeReady = FreedVpnService.dnsGuardRuntimeReady,
        dnsGuardRuntimeIssue = FreedVpnService.dnsGuardRuntimeIssue,
        dnsGuardUserEnabled = dnsGuardUserEnabled,
        dnsGuardAutoRestartEligible = dnsGuardAutoRestartEligible,
        dnsGuardLastAutoRestartAction = FreedVpnService.lastAutoRestartAction(context),
        dnsGuardLastAutoRestartAt = FreedVpnService.lastAutoRestartAt(context),
        dnsGuardLastAutoRestartResult = FreedVpnService.lastAutoRestartResult(context),
        dnsGuardLastAutoRestartSkipReason = FreedVpnService.lastAutoRestartSkipReason(context),
        adultDomainFeedVersion = FreedAdultDomainFeed.version(context),
        adultDomainFeedChecksum = FreedAdultDomainFeed.checksum(context),
        adultDomainFeedDomainCount = FreedAdultDomainFeed.domainCount(context)
      )
    }

    AsyncFunction("runActivationDiagnostics") { adultHost: String, normalHost: String, requireReviewedAdultFeed: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "platform" to "android",
        "checkedNativeLayer" to false,
        "nativeChecksPassed" to false,
        "adultBlocked" to false,
        "normalAllowed" to false,
        "issues" to listOf("React context is unavailable."),
        "message" to "Native Android activation diagnostics could not run."
      )

      activationDiagnosticsPayload(context, adultHost, normalHost, requireReviewedAdultFeed)
    }

    AsyncFunction("requestAuthorization") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )

      val route = openAndroidSettingsRoute(
        context,
        accessibilityServiceDetailsSettingsIntent(context),
        listOf(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), appDetailsSettingsIntent(context), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened FREED Protection Accessibility details. Enable the service so adult-site attempts and app limits can redirect into challenges.",
          "Opened Android app settings as a fallback. If Accessibility is not shown directly, use Accessibility > FREED Protection, then return to FREED.",
          "Android Accessibility settings could not be opened. Open Android Settings > Accessibility > FREED Protection, then return to FREED."
        ),
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = false,
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = route.openedAction,
        androidSettingsRouteComponent = route.openedComponent,
        androidSettingsFallbackUsed = route.fallbackUsed,
        androidSettingsRouteError = route.error
      ))
    }

    AsyncFunction("openUsageAccessSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )

      val route = openAndroidSettingsRoute(
        context,
        usageAccessSettingsIntent(context),
        listOf(
          Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
          usageAccessConfigIntent(context),
          appDetailsSettingsIntent(context),
          Intent(Settings.ACTION_SETTINGS)
        )
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android Usage Access settings for FREED. Allow FREED so selected app timers can be checked without reading in-app content.",
          "Opened an Android settings fallback. If FREED is not shown directly, use Special app access > Usage access > FREED, then return to FREED.",
          "Android Usage Access settings could not be opened. Open Android Settings > Special app access > Usage access > FREED, then return to FREED."
        ),
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = route.openedAction,
        androidSettingsRouteComponent = route.openedComponent,
        androidSettingsFallbackUsed = route.fallbackUsed,
        androidSettingsRouteError = route.error,
        androidUsageAccessConfigActivity = usageAccessConfigActivityName(context),
        androidUsageAccessReason = context.getString(R.string.freed_usage_access_reason),
        blockedApplications = blockedApplicationCount(context)
      ))
    }

    AsyncFunction("openPrivateDnsSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      val route = openAndroidSettingsRoute(
        context,
        ACTION_PRIVATE_DNS_SETTINGS,
        listOf(Intent(Settings.ACTION_WIRELESS_SETTINGS), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (FreedVpnService.isRunning) "dns" else "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android Private DNS settings. Review strict encrypted DNS, then return to FREED and verify DNS Guard.",
          "Opened an Android settings fallback. Review Network & internet > Private DNS, then return to FREED and verify DNS Guard.",
          "Android network settings could not be opened. Review Private DNS manually, then return to FREED and verify DNS Guard."
        ),
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = route.openedAction,
        androidSettingsRouteComponent = route.openedComponent,
        androidSettingsFallbackUsed = route.fallbackUsed,
        androidSettingsRouteError = route.error
      ))
    }

    AsyncFunction("openAndroidNotificationSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      val route = openAndroidSettingsRoute(
        context,
        androidNotificationSettingsIntent(context),
        listOf(appDetailsSettingsIntent(context), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (FreedVpnService.isRunning) "dns" else "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android notification settings for FREED. Allow notifications so DNS Guard recovery challenges stay visible if Android blocks a background launch.",
          "Opened Android app settings as a fallback. Enable FREED notifications, then return so recovery challenges stay visible.",
          "Android notification settings could not be opened. Open Android Settings > Apps > FREED > Notifications, then return to FREED."
        ),
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = route.openedAction,
        androidSettingsRouteComponent = route.openedComponent,
        androidSettingsFallbackUsed = route.fallbackUsed,
        androidSettingsRouteError = route.error,
        androidSettingsRouteOpenedAt = route.openedAt,
        androidNotificationPermissionRequired = isAndroidNotificationPermissionRequired(),
        androidNotificationPermissionGranted = isAndroidNotificationPermissionGranted(context)
      ))
    }

    AsyncFunction("applyAdultContentFilter") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      val prepareIntent = VpnService.prepare(context)
      if (prepareIntent != null) {
        FreedVpnService.setUserEnabled(context, false)
        prepareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val consentRoute = runCatching {
          context.startActivity(prepareIntent)
        }
        val consentAction = prepareIntent.action ?: "android.net.VpnService.prepare"
        val consentError = consentRoute.exceptionOrNull()?.localizedMessage
          ?: consentRoute.exceptionOrNull()?.javaClass?.simpleName
        val consentOpened = consentRoute.isSuccess
        val route = AndroidSettingsRouteResult(
          openedAction = consentAction,
          openedComponent = null,
          fallbackUsed = false,
          error = consentError,
          openedAt = formatIsoMillis(System.currentTimeMillis())
        )
        persistAndroidSettingsRoute(context, route)
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = false,
          active = false,
          mode = "dns",
          message = if (consentOpened) {
            "Approve Android VPN permission to enable FREED DNS Guard. It routes DNS resolver IPs only for adult-domain blocking."
          } else {
            "Android VPN permission could not be opened. Reopen FREED setup and try DNS Guard again; Android must show the system VPN consent before protection can start."
          },
          adultFilterActive = false,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = true,
          androidSettingsRoutes = androidSettingsRoutes(),
          androidSettingsRouteOpened = route.openedAction,
          androidSettingsRouteComponent = route.openedComponent,
          androidSettingsFallbackUsed = route.fallbackUsed,
          androidSettingsRouteError = route.error,
          androidSettingsRouteOpenedAt = route.openedAt
        ))
      }

      FreedVpnService.startUserEnabledGuard(context)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = true,
        active = true,
        mode = "dns",
        message = "FREED DNS Guard started for DNS-only adult-domain filtering.",
        adultFilterActive = true,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = false,
        androidSettingsRoutes = androidSettingsRoutes()
      ))
    }

    AsyncFunction("stopAdultContentFilter") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      FreedVpnService.setUserEnabled(context, false)
      context.startService(Intent(context, FreedVpnService::class.java).apply {
        action = FreedVpnService.ACTION_STOP
      })

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = true,
        active = false,
        mode = "dns",
        message = "FREED DNS Guard stopped.",
        adultFilterActive = false,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes()
      ))
    }

    AsyncFunction("configureBlockedAppPackages") { packages: List<String>, dailyLimitMinutes: Int?, shortFormInterruptionSeconds: Int? ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val sanitized = sanitizeBlockedAppPackages(packages)
      val sanitizedDailyLimit = sanitizeDailyLimitMinutes(dailyLimitMinutes)
      val sanitizedShortFormThreshold = sanitizeShortFormThresholdSeconds(shortFormInterruptionSeconds)

      context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, sanitized.joinToString(","))
        .putInt(FreedAccessibilityService.DAILY_LIMIT_MINUTES, sanitizedDailyLimit)
        .putInt(FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS, sanitizedShortFormThreshold)
        .apply()
      val usageStatsSnapshot = queryConfiguredUsageStats(context)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (sanitized.isEmpty()) {
          "Configured app blocking is off."
        } else {
          "Configured app blocking is ready for ${sanitized.size} app${if (sanitized.size == 1) "" else "s"}."
        },
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        usageStatsObservedPackages = usageStatsSnapshot?.observedPackages,
        usageStatsObservedPackageNames = usageStatsSnapshot?.observedPackageNames,
        usageStatsTodayMinutes = usageStatsSnapshot?.todayMinutes,
        usageStatsTodayMinutesByPackage = usageStatsSnapshot?.todayMinutesByPackage,
        blockedApplications = sanitized.size,
        dailyLimitMinutes = sanitizedDailyLimit,
        shortFormInterruptionSeconds = sanitizedShortFormThreshold,
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        activeUnlockExpiresAt = activeEarnedUnlockExpiresAt(context)
      ))
    }

    AsyncFunction("configureAdultDomainFeed") { domains: List<String>, version: String, checksum: String, generatedAt: String ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      FreedAdultDomainFeed.configure(context, domains, version, checksum, generatedAt)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = "Adult-domain feed ${FreedAdultDomainFeed.version(context) ?: "configured"} synced to native protection.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        adultDomainFeedVersion = FreedAdultDomainFeed.version(context),
        adultDomainFeedChecksum = FreedAdultDomainFeed.checksum(context),
        adultDomainFeedDomainCount = FreedAdultDomainFeed.domainCount(context)
      ))
    }

    AsyncFunction("startFocusShieldCalibration") { request: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction FreedFocusShieldCalibrationBridge.failStart(
        "React context is unavailable, so calibration cannot start."
      )
      if (!isAccessibilityServiceEnabled(context)) {
        return@AsyncFunction FreedFocusShieldCalibrationBridge.permissionRevoked()
      }
      FreedFocusShieldCalibrationBridge.start(request)
    }

    AsyncFunction("cancelFocusShieldCalibration") {
      FreedFocusShieldCalibrationBridge.cancel()
    }

    AsyncFunction("getFocusShieldCalibration") {
      val context = appContext.reactContext
      if (context != null && !isAccessibilityServiceEnabled(context)) {
        FreedFocusShieldCalibrationBridge.permissionRevoked()
      } else {
        FreedFocusShieldCalibrationBridge.get()
      }
    }

    AsyncFunction("configureFocusShieldRule") { rule: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "available" to false,
        "rule" to null,
        "message" to "React context is unavailable."
      )
      val storedRule = FreedFocusShieldRules.configure(context, rule)
      if (storedRule == null) {
        return@AsyncFunction mapOf(
          "available" to true,
          "rule" to null,
          "message" to "Focus Shield rejected an invalid or unsupported local rule."
        )
      }

      mapOf(
        "available" to true,
        "rule" to storedRule.toPayload(),
        "message" to "Focus Shield rule saved locally on this device."
      )
    }

    AsyncFunction("listFocusShieldRules") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      FreedFocusShieldRules.list(context).map(FreedFocusShieldRule::toPayload)
    }

    AsyncFunction("removeFocusShieldRule") { ruleId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      FreedFocusShieldRules.remove(context, ruleId)
    }

    AsyncFunction("applyFocusShieldEarnedUnlock") { expiresAt: String, scope: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val kind = scope["kind"] as? String
      val ruleId = scope["ruleId"] as? String
      val packageName = scope["packageName"] as? String
      val boundedExpiresAt = if (kind == "android-surface" && ruleId != null && packageName != null) {
        FreedFocusShieldRules.applySurfaceUnlock(context, expiresAt, ruleId, packageName)
      } else {
        null
      }

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (boundedExpiresAt != null) {
          "Focus Shield earned unlock is active only for the matching surface rule. Package limits and adult-domain protection stay active."
        } else {
          "Focus Shield kept protection active because the surface unlock scope or expiry was invalid."
        },
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        activeFocusShieldUnlockExpiresAt = boundedExpiresAt,
        activeFocusShieldUnlockRuleId = if (boundedExpiresAt != null) ruleId else null,
        activeFocusShieldUnlockPackageName = if (boundedExpiresAt != null) packageName else null
      ))
    }

    AsyncFunction("applyEarnedUnlockWindow") { expiresAt: String, sourceAttemptHost: String?, _nativeInterventionId: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val nowMs = System.currentTimeMillis()
      val expiryMs = parseIsoMillis(expiresAt)
      if (expiryMs == null || expiryMs <= nowMs) {
        clearEarnedUnlockPrefs(context)
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
          message = "Earned unlock expired. FREED protection is active again.",
          adultFilterActive = FreedVpnService.isRunning,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = isVpnConsentRequired(context),
          androidSettingsRoutes = androidSettingsRoutes()
        ))
      }

      val sourcePackage = packageForUnlockSourceHost(sourceAttemptHost)
      if (sourcePackage == null) {
        clearEarnedUnlockPrefs(context)
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
          message = "Earned unlock source is not a supported app. FREED kept app shields active and adult-domain filtering protected.",
          adultFilterActive = FreedVpnService.isRunning,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = isVpnConsentRequired(context),
          androidSettingsRoutes = androidSettingsRoutes()
        ))
      }

      val maxExpiryMs = nowMs + FreedAccessibilityService.MAX_EARNED_UNLOCK_MINUTES * 60_000L
      val boundedExpiresAt = if (expiryMs > maxExpiryMs) formatIsoMillis(maxExpiryMs) else expiresAt
      context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, boundedExpiresAt)
        .putString(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE, sourcePackage)
        .apply()

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = "Earned unlock window is active. Adult-domain filtering stays protected.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        activeUnlockExpiresAt = boundedExpiresAt,
        activeUnlockSourcePackage = sourcePackage
      ))
    }

    AsyncFunction("clearEarnedUnlockWindow") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      clearEarnedUnlockPrefs(context)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = "Earned unlock cleared. FREED protection is active again.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes()
      ))
    }

    AsyncFunction("openProtectionSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )

      val route = openAndroidSettingsRoute(
        context,
        accessibilityServiceDetailsSettingsIntent(context),
        listOf(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), appDetailsSettingsIntent(context), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context),
        active = isAccessibilityServiceEnabled(context),
        mode = "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened FREED Protection Accessibility details. Enable the service for adult-site challenge redirects and app timers.",
          "Opened Android app settings as a fallback. If Accessibility is not shown directly, use Accessibility > FREED Protection, then return to FREED.",
          "Android Accessibility settings could not be opened. Open Android Settings > Accessibility > FREED Protection, then return to FREED."
        ),
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        androidSettingsRouteOpened = route.openedAction,
        androidSettingsRouteComponent = route.openedComponent,
        androidSettingsFallbackUsed = route.fallbackUsed,
        androidSettingsRouteError = route.error
      ))
    }

    AsyncFunction("getPendingIntervention") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      val pendingSnapshot = prefs.all
      val storedUrl = pendingSnapshot[FreedAccessibilityService.PENDING_URL] as? String ?: return@AsyncFunction null
      val interventionId = sanitizedPendingInterventionId(
        pendingSnapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] as? String
      ) ?: return@AsyncFunction null
      if (isPendingInterventionConsumed(prefs, interventionId)) return@AsyncFunction null
      val detectedAt = pendingSnapshot[FreedAccessibilityService.PENDING_DETECTED_AT] as? String ?: ""

      if (!isFreshPendingIntervention(detectedAt)) {
        claimPendingIntervention(prefs, interventionId)
        return@AsyncFunction null
      }

      val host = sanitizedPendingHost(
        pendingSnapshot[FreedAccessibilityService.PENDING_HOST] as? String ?: "",
        storedUrl
      )
      val url = "https://$host"
      val matchedRule = pendingSnapshot[FreedAccessibilityService.PENDING_RULE] as? String ?: ""
      val sourcePackage = sanitizedPendingSourcePackage(
        pendingSnapshot[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] as? String,
        matchedRule
      )

      mutableMapOf<String, Any>(
        "interventionId" to interventionId,
        "url" to url,
        "host" to host,
        "sourcePackage" to sourcePackage,
        "reason" to (pendingSnapshot[FreedAccessibilityService.PENDING_REASON] as? String ?: ""),
        "matchedRule" to matchedRule,
        "detectedAt" to detectedAt,
        "sessionDurationSec" to sanitizedPendingSessionDuration(pendingSnapshot)
      ).apply {
        val focusShieldRuleId = (pendingSnapshot[FreedAccessibilityService.PENDING_FOCUS_SHIELD_RULE_ID] as? String)
          ?.takeIf { storedRuleId -> FreedFocusShieldRules.list(context).any { rule -> rule.id == storedRuleId && rule.packageName == sourcePackage } }
        if (focusShieldRuleId != null) {
          put(
            "scope",
            mapOf(
              "kind" to "android-surface",
              "ruleId" to focusShieldRuleId,
              "packageName" to sourcePackage
            )
          )
        }
      }
    }

    AsyncFunction("clearPendingIntervention") { expectedInterventionId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      val sanitizedExpectedInterventionId = sanitizedPendingInterventionId(expectedInterventionId)
        ?: return@AsyncFunction false
      claimPendingIntervention(prefs, sanitizedExpectedInterventionId)
    }

    AsyncFunction("classifyChallengePhoto") { uri: String, expectedLabels: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction photoClassificationPayload(
        available = false,
        matched = false,
        labels = emptyList(),
        matchedLabels = emptyList(),
        confidence = null,
        message = "React context is unavailable."
      )

      classifyChallengePhoto(context, uri, expectedLabels)
    }
  }

  private fun isAccessibilityServiceEnabled(context: Context): Boolean {
    val expected = ComponentName(context, FreedAccessibilityService::class.java)
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ).orEmpty()

    return enabledServices
      .split(":")
      .any { enabled ->
        enabled.equals(expected.flattenToString(), ignoreCase = true) ||
          enabled.equals(expected.flattenToShortString(), ignoreCase = true)
      }
  }

  private fun isUsageStatsAuthorized(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private data class UsageStatsSnapshot(
    val observedPackages: Int,
    val observedPackageNames: List<String>,
    val todayMinutes: Int,
    val todayMinutesByPackage: Map<String, Int>
  )

  private fun queryConfiguredUsageStats(context: Context): UsageStatsSnapshot? {
    if (!isUsageStatsAuthorized(context)) return null
    val packages = configuredBlockedPackages(context)
    if (packages.isEmpty()) {
      return UsageStatsSnapshot(
        observedPackages = 0,
        observedPackageNames = emptyList(),
        todayMinutes = 0,
        todayMinutesByPackage = emptyMap()
      )
    }

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    val stats = usageStatsManager.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      calendar.timeInMillis,
      System.currentTimeMillis()
    ).orEmpty()
    val totalMsByPackage = packages.associateWith { 0L }.toMutableMap()
    stats.forEach { item ->
      val packageName = item.packageName?.lowercase(Locale.US) ?: return@forEach
      if (packages.contains(packageName)) {
        totalMsByPackage[packageName] = (totalMsByPackage[packageName] ?: 0L) + item.totalTimeInForeground
      }
    }
    val observedPackageNames = packages.filter { packageName -> (totalMsByPackage[packageName] ?: 0L) > 0L }
    val todayMinutesByPackage = packages.associateWith { packageName ->
      ((totalMsByPackage[packageName] ?: 0L) / 60_000L).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
    }
    val totalMs = totalMsByPackage.values.sum()

    return UsageStatsSnapshot(
      observedPackages = observedPackageNames.size,
      observedPackageNames = observedPackageNames,
      todayMinutes = (totalMs / 60_000L).coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
      todayMinutesByPackage = todayMinutesByPackage
    )
  }

  private fun activationDiagnosticsPayload(
    context: Context,
    adultHostInput: String,
    normalHostInput: String,
    requireReviewedAdultFeed: Boolean
  ): Map<String, Any> {
    val adultHost = sanitizeActivationHost(adultHostInput, "pornhub.com")
    val normalHost = sanitizeActivationHost(normalHostInput, "www.khanacademy.org")
    val domains = FreedAdultDomainFeed.domains(context)
    val adultClassification = FreedUrlClassifier.classify("https://$adultHost", domains)
    val normalClassification = FreedUrlClassifier.classify("https://$normalHost", domains)
    val feedVersion = FreedAdultDomainFeed.version(context)
    val feedChecksum = FreedAdultDomainFeed.checksum(context)
    val feedCount = FreedAdultDomainFeed.domainCount(context)
    val accessibilityEnabled = isAccessibilityServiceEnabled(context)
    val usageStatsAuthorized = isUsageStatsAuthorized(context)
    val usageStatsSnapshot = queryConfiguredUsageStats(context)
    val vpnConsentRequired = isVpnConsentRequired(context)
    val blockedApplications = blockedApplicationCount(context)
    val lastSettingsRoute = lastAndroidSettingsRoute(context)
    val privateDnsMode = getPrivateDnsMode(context)
    val privateDnsSpecifier = getPrivateDnsSpecifier(context)
    val dnsGuardResolverCount = FreedVpnService.DNS_RESOLVERS.size
    val issues = mutableListOf<String>()
    val issueCodes = mutableListOf<String>()

    if (!FreedVpnService.isRunning) {
      issues += "DNS Guard is not running."
      issueCodes += "android-dns-guard-not-running"
    } else if (!FreedVpnService.dnsGuardRuntimeReady) {
      issues += FreedVpnService.dnsGuardRuntimeIssue ?: "DNS Guard runtime is not ready."
      issueCodes += "android-dns-guard-runtime-not-ready"
    }
    if (dnsGuardResolverCount <= 0) {
      issues += "DNS Guard resolver list is empty."
      issueCodes += "android-dns-guard-resolvers-empty"
    }
    if (vpnConsentRequired) {
      issues += "Android VPN consent is not approved for DNS Guard."
      issueCodes += "android-vpn-consent-required"
    }
    if (!accessibilityEnabled) {
      issues += "AccessibilityService is not enabled."
      issueCodes += "android-accessibility-disabled"
    }
    if (!usageStatsAuthorized) {
      issues += "Usage Access is not authorized."
      issueCodes += "android-usage-access-disabled"
    }
    if (blockedApplications <= 0) {
      issues += "No selected app packages are synced for app timers."
      issueCodes += "android-selected-apps-missing"
    }
    if (feedCount <= 0) {
      issues += "Native adult-domain feed is empty."
      issueCodes += "android-adult-feed-empty"
    }
    if (requireReviewedAdultFeed && !isReviewedFeedVersion(feedVersion)) {
      issues += "Native adult-domain feed is still embedded fallback, not reviewed remote provenance."
      issueCodes += "android-adult-feed-not-reviewed"
    }
    if (!adultClassification.shouldBlock) {
      issues += "Native adult-domain smoke host was not blocked."
      issueCodes += "android-adult-smoke-not-blocked"
    }
    if (normalClassification.shouldBlock) {
      issues += "Native normal-site smoke host was blocked."
      issueCodes += "android-normal-smoke-blocked"
    }

    val passed = issues.isEmpty()
    return mapOf(
      "platform" to "android",
      "checkedNativeLayer" to true,
      "nativeChecksPassed" to passed,
      "adultBlocked" to adultClassification.shouldBlock,
      "normalAllowed" to !normalClassification.shouldBlock,
      "message" to if (passed) {
        "Android native activation diagnostics passed for DNS Guard, Accessibility, Usage Access, selected app timers, and domain classification."
      } else {
        "Android native activation diagnostics need attention."
      },
      "issues" to issues,
      "issueCodes" to issueCodes,
      "adultMatchedRule" to adultClassification.matchedRule,
      "normalMatchedRule" to normalClassification.matchedRule,
      "dnsGuardActive" to FreedVpnService.isRunning,
      "dnsGuardRuntimeReady" to FreedVpnService.dnsGuardRuntimeReady,
      "dnsGuardRuntimeIssue" to (FreedVpnService.dnsGuardRuntimeIssue ?: ""),
      "vpnConsentRequired" to vpnConsentRequired,
      "androidNotificationPermissionRequired" to isAndroidNotificationPermissionRequired(),
      "androidNotificationPermissionGranted" to isAndroidNotificationPermissionGranted(context),
      "appInterventionAuthorized" to accessibilityEnabled,
      "usageStatsAuthorized" to usageStatsAuthorized,
      "usageStatsObservedPackages" to (usageStatsSnapshot?.observedPackages ?: 0),
      "usageStatsObservedPackageNames" to (usageStatsSnapshot?.observedPackageNames ?: emptyList<String>()),
      "usageStatsTodayMinutes" to (usageStatsSnapshot?.todayMinutes ?: 0),
      "usageStatsTodayMinutesByPackage" to (usageStatsSnapshot?.todayMinutesByPackage ?: emptyMap<String, Int>()),
      "blockedApplications" to blockedApplications,
      "androidSettingsRoutes" to androidSettingsRoutes(),
      "androidSettingsRouteOpened" to (lastSettingsRoute?.openedAction ?: ""),
      "androidSettingsRouteComponent" to (lastSettingsRoute?.openedComponent ?: ""),
      "androidSettingsRouteLabel" to (lastSettingsRoute?.let { androidSettingsRouteLabel(it.openedAction) } ?: ""),
      "androidSettingsRouteInstruction" to (lastSettingsRoute?.let { androidSettingsRouteInstruction(it.openedAction, it.fallbackUsed) } ?: ""),
      "androidSettingsFallbackUsed" to (lastSettingsRoute?.fallbackUsed ?: false),
      "androidSettingsRouteError" to (lastSettingsRoute?.error ?: ""),
      "androidSettingsRouteOpenedAt" to (lastSettingsRoute?.openedAt ?: ""),
      "privateDnsMode" to privateDnsMode,
      "privateDnsSpecifier" to (privateDnsSpecifier ?: ""),
      "dnsGuardResolverCount" to dnsGuardResolverCount,
      "dnsGuardLastResolver" to (FreedVpnService.lastForwardResolver ?: ""),
      "dnsGuardLastForwardFailure" to (FreedVpnService.lastForwardFailure ?: ""),
      "dnsGuardUptimeMs" to FreedVpnService.dnsGuardUptimeMs,
      "dnsGuardSessionQueries" to FreedVpnService.dnsGuardSessionQueries.get(),
      "dnsGuardAllowedQueries" to FreedVpnService.dnsGuardAllowedQueries.get(),
      "dnsGuardBlockedQueries" to FreedVpnService.dnsGuardBlockedQueries.get(),
      "dnsGuardServfailResponses" to FreedVpnService.dnsGuardServfailResponses.get(),
      "dnsGuardMalformedPackets" to FreedVpnService.dnsGuardMalformedPackets.get(),
      "dnsGuardUserEnabled" to FreedVpnService.isUserEnabled(context),
      "dnsGuardAutoRestartEligible" to FreedVpnService.isAutoRestartEligible(context),
      "dnsGuardLastAutoRestartAction" to (FreedVpnService.lastAutoRestartAction(context) ?: ""),
      "dnsGuardLastAutoRestartAt" to (FreedVpnService.lastAutoRestartAt(context) ?: ""),
      "dnsGuardLastAutoRestartResult" to (FreedVpnService.lastAutoRestartResult(context) ?: ""),
      "dnsGuardLastAutoRestartSkipReason" to (FreedVpnService.lastAutoRestartSkipReason(context) ?: ""),
      "adultDomainFeedVersion" to (feedVersion ?: ""),
      "adultDomainFeedChecksum" to (feedChecksum ?: ""),
      "adultDomainFeedDomainCount" to feedCount
    )
  }

  private fun sanitizeActivationHost(input: String, fallback: String): String {
    val normalized = FreedUrlClassifier.normalizeHostForStorage(input)
    if (normalized.isNotBlank()) return normalized
    return fallback
  }

  private fun isReviewedFeedVersion(version: String?): Boolean {
    val value = version?.trim().orEmpty()
    return value.isNotBlank() && !value.startsWith("freed-embedded-")
  }

  private fun statusPayloadWithAndroidDiagnostics(context: Context, payload: Map<String, Any>): Map<String, Any> {
    val enriched = payload.toMutableMap()
    val usageStatsSnapshot = queryConfiguredUsageStats(context)
    val accessibilityEnabled = isAccessibilityServiceEnabled(context)
    val dnsGuardActive = FreedVpnService.isRunning
    val dnsGuardAutoRestartEligible = FreedVpnService.isAutoRestartEligible(context)
    val lastSettingsRoute = lastAndroidSettingsRoute(context)

    fun putIfMissing(key: String, value: Any?) {
      if (!enriched.containsKey(key) && value != null) {
        enriched[key] = value
      }
    }

    enriched["authorized"] = accessibilityEnabled || dnsGuardActive || dnsGuardAutoRestartEligible
    enriched["active"] = accessibilityEnabled || dnsGuardActive
    enriched["mode"] = if (accessibilityEnabled) "accessibility" else if (dnsGuardActive) "dns" else (enriched["mode"] ?: "dns")
    putIfMissing("adultFilterActive", dnsGuardActive)
    putIfMissing("appInterventionAuthorized", accessibilityEnabled)
    putIfMissing("usageStatsAuthorized", isUsageStatsAuthorized(context))
    putIfMissing("usageStatsObservedPackages", usageStatsSnapshot?.observedPackages)
    putIfMissing("usageStatsObservedPackageNames", usageStatsSnapshot?.observedPackageNames)
    putIfMissing("usageStatsTodayMinutes", usageStatsSnapshot?.todayMinutes)
    putIfMissing("usageStatsTodayMinutesByPackage", usageStatsSnapshot?.todayMinutesByPackage)
    putIfMissing("blockedApplications", blockedApplicationCount(context))
    putIfMissing("dailyLimitMinutes", configuredDailyLimitMinutes(context))
    putIfMissing("shortFormInterruptionSeconds", configuredShortFormThresholdSeconds(context))
    val focusShieldSnapshot = FreedFocusShieldRules.snapshot(context)
    putIfMissing("focusShieldRuleCount", focusShieldSnapshot.rules.size)
    putIfMissing("focusShieldEnabledRuleCount", focusShieldSnapshot.enabledCount)
    putIfMissing("focusShieldRuleStoreHealth", focusShieldSnapshot.health)
    putIfMissing("activeFocusShieldUnlockExpiresAt", FreedFocusShieldRules.activeSurfaceUnlockExpiresAt(context))
    putIfMissing("activeFocusShieldUnlockRuleId", FreedFocusShieldRules.activeSurfaceUnlockRuleId(context))
    putIfMissing("activeFocusShieldUnlockPackageName", FreedFocusShieldRules.activeSurfaceUnlockPackage(context))
    putIfMissing("activeUnlockExpiresAt", activeEarnedUnlockExpiresAt(context))
    putIfMissing("activeUnlockSourcePackage", activeUnlockSourcePackage(context))
    putIfMissing("vpnConsentRequired", isVpnConsentRequired(context))
    putIfMissing("androidSettingsRoutes", androidSettingsRoutes())
    putIfMissing("androidSettingsRouteOpened", lastSettingsRoute?.openedAction)
    putIfMissing("androidSettingsRouteComponent", lastSettingsRoute?.openedComponent)
    putIfMissing("androidSettingsRouteLabel", lastSettingsRoute?.let { androidSettingsRouteLabel(it.openedAction) })
    putIfMissing("androidSettingsRouteInstruction", lastSettingsRoute?.let { androidSettingsRouteInstruction(it.openedAction, it.fallbackUsed) })
    putIfMissing("androidSettingsFallbackUsed", lastSettingsRoute?.fallbackUsed)
    putIfMissing("androidSettingsRouteError", lastSettingsRoute?.error)
    putIfMissing("androidSettingsRouteOpenedAt", lastSettingsRoute?.openedAt)
    putIfMissing("androidNotificationPermissionRequired", isAndroidNotificationPermissionRequired())
    putIfMissing("androidNotificationPermissionGranted", isAndroidNotificationPermissionGranted(context))
    putIfMissing("androidUsageAccessConfigActivity", usageAccessConfigActivityName(context))
    putIfMissing("androidUsageAccessReason", context.getString(R.string.freed_usage_access_reason))
    putIfMissing("privateDnsMode", getPrivateDnsMode(context))
    putIfMissing("privateDnsSpecifier", getPrivateDnsSpecifier(context))
    putIfMissing("dnsGuardResolverCount", FreedVpnService.DNS_RESOLVERS.size)
    putIfMissing("dnsGuardLastResolver", FreedVpnService.lastForwardResolver)
    putIfMissing("dnsGuardLastForwardFailure", FreedVpnService.lastForwardFailure)
    putIfMissing("dnsGuardStartedAtElapsedMs", FreedVpnService.dnsGuardStartedAtElapsedMs)
    putIfMissing("dnsGuardUptimeMs", FreedVpnService.dnsGuardUptimeMs)
    putIfMissing("dnsGuardLastStopReason", FreedVpnService.dnsGuardLastStopReason)
    putIfMissing("dnsGuardLastSessionDurationMs", FreedVpnService.dnsGuardLastSessionDurationMs)
    putIfMissing("dnsGuardStartCount", FreedVpnService.dnsGuardStartCount.get())
    putIfMissing("dnsGuardStopCount", FreedVpnService.dnsGuardStopCount.get())
    putIfMissing("dnsGuardPacketsRead", FreedVpnService.dnsGuardPacketsRead.get())
    putIfMissing("dnsGuardSessionQueries", FreedVpnService.dnsGuardSessionQueries.get())
    putIfMissing("dnsGuardAllowedQueries", FreedVpnService.dnsGuardAllowedQueries.get())
    putIfMissing("dnsGuardBlockedQueries", FreedVpnService.dnsGuardBlockedQueries.get())
    putIfMissing("dnsGuardServfailResponses", FreedVpnService.dnsGuardServfailResponses.get())
    putIfMissing("dnsGuardMalformedPackets", FreedVpnService.dnsGuardMalformedPackets.get())
    putIfMissing("dnsGuardRuntimeReady", FreedVpnService.dnsGuardRuntimeReady)
    putIfMissing("dnsGuardRuntimeIssue", FreedVpnService.dnsGuardRuntimeIssue)
    putIfMissing("dnsGuardUserEnabled", FreedVpnService.isUserEnabled(context))
    putIfMissing("dnsGuardAutoRestartEligible", dnsGuardAutoRestartEligible)
    putIfMissing("dnsGuardLastAutoRestartAction", FreedVpnService.lastAutoRestartAction(context))
    putIfMissing("dnsGuardLastAutoRestartAt", FreedVpnService.lastAutoRestartAt(context))
    putIfMissing("dnsGuardLastAutoRestartResult", FreedVpnService.lastAutoRestartResult(context))
    putIfMissing("dnsGuardLastAutoRestartSkipReason", FreedVpnService.lastAutoRestartSkipReason(context))
    putIfMissing("adultDomainFeedVersion", FreedAdultDomainFeed.version(context))
    putIfMissing("adultDomainFeedChecksum", FreedAdultDomainFeed.checksum(context))
    putIfMissing("adultDomainFeedDomainCount", FreedAdultDomainFeed.domainCount(context))

    return enriched
  }

  private fun statusPayload(
    authorized: Boolean,
    active: Boolean,
    mode: String,
    message: String,
    adultFilterActive: Boolean? = null,
    appInterventionAuthorized: Boolean? = null,
    usageStatsAuthorized: Boolean? = null,
    usageStatsObservedPackages: Int? = null,
    usageStatsObservedPackageNames: List<String>? = null,
    usageStatsTodayMinutes: Int? = null,
    usageStatsTodayMinutesByPackage: Map<String, Int>? = null,
    blockedApplications: Int? = null,
    dailyLimitMinutes: Int? = null,
    shortFormInterruptionSeconds: Int? = null,
    focusShieldRuleCount: Int? = null,
    focusShieldEnabledRuleCount: Int? = null,
    focusShieldRuleStoreHealth: String? = null,
    activeFocusShieldUnlockExpiresAt: String? = null,
    activeFocusShieldUnlockRuleId: String? = null,
    activeFocusShieldUnlockPackageName: String? = null,
    activeUnlockExpiresAt: String? = null,
    activeUnlockSourcePackage: String? = null,
    vpnConsentRequired: Boolean? = null,
    androidSettingsRoutes: List<String>? = null,
    androidSettingsRouteOpened: String? = null,
    androidSettingsRouteComponent: String? = null,
    androidSettingsRouteLabel: String? = null,
    androidSettingsRouteInstruction: String? = null,
    androidSettingsFallbackUsed: Boolean? = null,
    androidSettingsRouteError: String? = null,
    androidSettingsRouteOpenedAt: String? = null,
    androidNotificationPermissionRequired: Boolean? = null,
    androidNotificationPermissionGranted: Boolean? = null,
    androidUsageAccessConfigActivity: String? = null,
    androidUsageAccessReason: String? = null,
    privateDnsMode: String? = null,
    privateDnsSpecifier: String? = null,
    dnsGuardResolverCount: Int? = null,
    dnsGuardLastResolver: String? = null,
    dnsGuardLastForwardFailure: String? = null,
    dnsGuardStartedAtElapsedMs: Long? = null,
    dnsGuardUptimeMs: Long? = null,
    dnsGuardLastStopReason: String? = null,
    dnsGuardLastSessionDurationMs: Long? = null,
    dnsGuardStartCount: Long? = null,
    dnsGuardStopCount: Long? = null,
    dnsGuardPacketsRead: Long? = null,
    dnsGuardSessionQueries: Long? = null,
    dnsGuardAllowedQueries: Long? = null,
    dnsGuardBlockedQueries: Long? = null,
    dnsGuardServfailResponses: Long? = null,
    dnsGuardMalformedPackets: Long? = null,
    dnsGuardRuntimeReady: Boolean? = null,
    dnsGuardRuntimeIssue: String? = null,
    dnsGuardUserEnabled: Boolean? = null,
    dnsGuardAutoRestartEligible: Boolean? = null,
    dnsGuardLastAutoRestartAction: String? = null,
    dnsGuardLastAutoRestartAt: String? = null,
    dnsGuardLastAutoRestartResult: String? = null,
    dnsGuardLastAutoRestartSkipReason: String? = null,
    adultDomainFeedVersion: String? = null,
    adultDomainFeedChecksum: String? = null,
    adultDomainFeedDomainCount: Int? = null
  ): Map<String, Any> {
    val payload = mutableMapOf<String, Any>(
      "authorized" to authorized,
      "active" to active,
      "mode" to mode,
      "message" to message
    )
    if (adultFilterActive != null) payload["adultFilterActive"] = adultFilterActive
    if (appInterventionAuthorized != null) payload["appInterventionAuthorized"] = appInterventionAuthorized
    if (usageStatsAuthorized != null) payload["usageStatsAuthorized"] = usageStatsAuthorized
    if (usageStatsObservedPackages != null) payload["usageStatsObservedPackages"] = usageStatsObservedPackages
    if (usageStatsObservedPackageNames != null) payload["usageStatsObservedPackageNames"] = usageStatsObservedPackageNames
    if (usageStatsTodayMinutes != null) payload["usageStatsTodayMinutes"] = usageStatsTodayMinutes
    if (usageStatsTodayMinutesByPackage != null) payload["usageStatsTodayMinutesByPackage"] = usageStatsTodayMinutesByPackage
    if (blockedApplications != null) payload["blockedApplications"] = blockedApplications
    if (dailyLimitMinutes != null) payload["dailyLimitMinutes"] = dailyLimitMinutes
    if (shortFormInterruptionSeconds != null) payload["shortFormInterruptionSeconds"] = shortFormInterruptionSeconds
    if (focusShieldRuleCount != null) payload["focusShieldRuleCount"] = focusShieldRuleCount
    if (focusShieldEnabledRuleCount != null) payload["focusShieldEnabledRuleCount"] = focusShieldEnabledRuleCount
    if (focusShieldRuleStoreHealth != null) payload["focusShieldRuleStoreHealth"] = focusShieldRuleStoreHealth
    if (activeFocusShieldUnlockExpiresAt != null) payload["activeFocusShieldUnlockExpiresAt"] = activeFocusShieldUnlockExpiresAt
    if (activeFocusShieldUnlockRuleId != null) payload["activeFocusShieldUnlockRuleId"] = activeFocusShieldUnlockRuleId
    if (activeFocusShieldUnlockPackageName != null) payload["activeFocusShieldUnlockPackageName"] = activeFocusShieldUnlockPackageName
    if (activeUnlockExpiresAt != null) payload["activeUnlockExpiresAt"] = activeUnlockExpiresAt
    if (activeUnlockSourcePackage != null) payload["activeUnlockSourcePackage"] = activeUnlockSourcePackage
    if (vpnConsentRequired != null) payload["vpnConsentRequired"] = vpnConsentRequired
    if (androidSettingsRoutes != null) payload["androidSettingsRoutes"] = androidSettingsRoutes
    if (androidSettingsRouteOpened != null) payload["androidSettingsRouteOpened"] = androidSettingsRouteOpened
    if (androidSettingsRouteComponent != null) payload["androidSettingsRouteComponent"] = androidSettingsRouteComponent
    if (androidSettingsRouteLabel != null) payload["androidSettingsRouteLabel"] = androidSettingsRouteLabel
    if (androidSettingsRouteInstruction != null) payload["androidSettingsRouteInstruction"] = androidSettingsRouteInstruction
    if (androidSettingsFallbackUsed != null) payload["androidSettingsFallbackUsed"] = androidSettingsFallbackUsed
    if (androidSettingsRouteError != null) payload["androidSettingsRouteError"] = androidSettingsRouteError
    if (androidSettingsRouteOpenedAt != null) payload["androidSettingsRouteOpenedAt"] = androidSettingsRouteOpenedAt
    if (androidNotificationPermissionRequired != null) payload["androidNotificationPermissionRequired"] = androidNotificationPermissionRequired
    if (androidNotificationPermissionGranted != null) payload["androidNotificationPermissionGranted"] = androidNotificationPermissionGranted
    if (androidUsageAccessConfigActivity != null) payload["androidUsageAccessConfigActivity"] = androidUsageAccessConfigActivity
    if (androidUsageAccessReason != null) payload["androidUsageAccessReason"] = androidUsageAccessReason
    if (privateDnsMode != null) payload["privateDnsMode"] = privateDnsMode
    if (privateDnsSpecifier != null) payload["privateDnsSpecifier"] = privateDnsSpecifier
    if (dnsGuardResolverCount != null) payload["dnsGuardResolverCount"] = dnsGuardResolverCount
    if (dnsGuardLastResolver != null) payload["dnsGuardLastResolver"] = dnsGuardLastResolver
    if (dnsGuardLastForwardFailure != null) payload["dnsGuardLastForwardFailure"] = dnsGuardLastForwardFailure
    if (dnsGuardStartedAtElapsedMs != null) payload["dnsGuardStartedAtElapsedMs"] = dnsGuardStartedAtElapsedMs
    if (dnsGuardUptimeMs != null) payload["dnsGuardUptimeMs"] = dnsGuardUptimeMs
    if (dnsGuardLastStopReason != null) payload["dnsGuardLastStopReason"] = dnsGuardLastStopReason
    if (dnsGuardLastSessionDurationMs != null) payload["dnsGuardLastSessionDurationMs"] = dnsGuardLastSessionDurationMs
    if (dnsGuardStartCount != null) payload["dnsGuardStartCount"] = dnsGuardStartCount
    if (dnsGuardStopCount != null) payload["dnsGuardStopCount"] = dnsGuardStopCount
    if (dnsGuardPacketsRead != null) payload["dnsGuardPacketsRead"] = dnsGuardPacketsRead
    if (dnsGuardSessionQueries != null) payload["dnsGuardSessionQueries"] = dnsGuardSessionQueries
    if (dnsGuardAllowedQueries != null) payload["dnsGuardAllowedQueries"] = dnsGuardAllowedQueries
    if (dnsGuardBlockedQueries != null) payload["dnsGuardBlockedQueries"] = dnsGuardBlockedQueries
    if (dnsGuardServfailResponses != null) payload["dnsGuardServfailResponses"] = dnsGuardServfailResponses
    if (dnsGuardMalformedPackets != null) payload["dnsGuardMalformedPackets"] = dnsGuardMalformedPackets
    if (dnsGuardRuntimeReady != null) payload["dnsGuardRuntimeReady"] = dnsGuardRuntimeReady
    if (dnsGuardRuntimeIssue != null) payload["dnsGuardRuntimeIssue"] = dnsGuardRuntimeIssue
    if (dnsGuardUserEnabled != null) payload["dnsGuardUserEnabled"] = dnsGuardUserEnabled
    if (dnsGuardAutoRestartEligible != null) payload["dnsGuardAutoRestartEligible"] = dnsGuardAutoRestartEligible
    if (dnsGuardLastAutoRestartAction != null) payload["dnsGuardLastAutoRestartAction"] = dnsGuardLastAutoRestartAction
    if (dnsGuardLastAutoRestartAt != null) payload["dnsGuardLastAutoRestartAt"] = dnsGuardLastAutoRestartAt
    if (dnsGuardLastAutoRestartResult != null) payload["dnsGuardLastAutoRestartResult"] = dnsGuardLastAutoRestartResult
    if (dnsGuardLastAutoRestartSkipReason != null) payload["dnsGuardLastAutoRestartSkipReason"] = dnsGuardLastAutoRestartSkipReason
    if (adultDomainFeedVersion != null) payload["adultDomainFeedVersion"] = adultDomainFeedVersion
    if (adultDomainFeedChecksum != null) payload["adultDomainFeedChecksum"] = adultDomainFeedChecksum
    if (adultDomainFeedDomainCount != null) payload["adultDomainFeedDomainCount"] = adultDomainFeedDomainCount
    return payload
  }

  private fun protectionStatusMessage(
    accessibilityEnabled: Boolean,
    dnsGuardActive: Boolean,
    privateDnsMode: String,
    dnsGuardUserEnabled: Boolean,
    dnsGuardAutoRestartEligible: Boolean,
    vpnConsentRequired: Boolean
  ): String {
    val privateDnsNote = if (isPrivateDnsStrict(privateDnsMode)) {
      " Strict Private DNS is enabled, so QA must verify DNS Guard resolver behavior on this device."
    } else {
      ""
    }

    return if (accessibilityEnabled) {
      "FREED Accessibility protection is enabled for supported browsers, focused WebView fields, and opted-in app timers.$privateDnsNote"
    } else if (dnsGuardActive) {
      "FREED DNS Guard is filtering DNS-level adult domains with resolver failover.$privateDnsNote"
    } else if (vpnConsentRequired) {
      "Android VPN consent is needed before FREED can start DNS Guard. Approve the system dialog, then FREED will retry DNS Guard when you return.$privateDnsNote"
    } else if (dnsGuardUserEnabled && dnsGuardAutoRestartEligible) {
      "FREED DNS Guard is user-enabled and eligible to restore after reboot or app update, but it is not currently running.$privateDnsNote"
    } else if (dnsGuardUserEnabled) {
      "FREED DNS Guard was user-enabled, but Android VPN permission must be reviewed before it can restart.$privateDnsNote"
    } else {
      "Enable FREED Protection in Android Accessibility settings.$privateDnsNote"
    }
  }

  private fun isPrivateDnsStrict(mode: String): Boolean {
    return mode.equals("hostname", ignoreCase = true)
  }

  private fun isVpnConsentRequired(context: Context): Boolean {
    return VpnService.prepare(context) != null
  }

  private fun androidSettingsRoutes(): List<String> {
    return listOf(
      ACTION_ACCESSIBILITY_DETAILS_SETTINGS,
      Settings.ACTION_APP_NOTIFICATION_SETTINGS,
      ACTION_PRIVATE_DNS_SETTINGS,
      INTENT_CATEGORY_USAGE_ACCESS_CONFIG,
      Settings.ACTION_ACCESSIBILITY_SETTINGS,
      Settings.ACTION_USAGE_ACCESS_SETTINGS,
      Settings.ACTION_WIRELESS_SETTINGS,
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Settings.ACTION_SETTINGS
    )
  }

  private data class AndroidSettingsRouteResult(
    val openedAction: String,
    val openedComponent: String?,
    val fallbackUsed: Boolean,
    val error: String?,
    val openedAt: String
  )

  private fun openAndroidSettingsRoute(
    context: Context,
    primaryAction: String,
    fallbacks: List<Intent> = emptyList()
  ): AndroidSettingsRouteResult {
    return openAndroidSettingsRoute(context, Intent(primaryAction), fallbacks)
  }

  private fun openAndroidSettingsRoute(
    context: Context,
    primaryIntent: Intent,
    fallbacks: List<Intent> = emptyList()
  ): AndroidSettingsRouteResult {
    val candidates = listOf(primaryIntent) + fallbacks
    var lastError: String? = null

    for ((index, candidate) in candidates.withIndex()) {
      val action = candidate.action ?: "unknown"
      val intent = Intent(candidate).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (intent.resolveActivity(context.packageManager) == null) {
        lastError = "$action is unavailable on this Android build."
        continue
      }

      val started = runCatching {
        context.startActivity(intent)
      }
      if (started.isSuccess) {
        return AndroidSettingsRouteResult(
          openedAction = action,
          openedComponent = androidSettingsRouteComponent(intent),
          fallbackUsed = index > 0,
          error = null,
          openedAt = formatIsoMillis(System.currentTimeMillis())
        ).also { persistAndroidSettingsRoute(context, it) }
      }
      val error = started.exceptionOrNull()
      lastError = "$action failed: ${error?.localizedMessage ?: error?.javaClass?.simpleName ?: "unknown error"}"
    }

    return AndroidSettingsRouteResult(
      openedAction = "none",
      openedComponent = null,
      fallbackUsed = true,
      error = lastError ?: "No Android settings screen accepted the request.",
      openedAt = formatIsoMillis(System.currentTimeMillis())
    ).also { persistAndroidSettingsRoute(context, it) }
  }

  private fun persistAndroidSettingsRoute(context: Context, route: AndroidSettingsRouteResult) {
    context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(ANDROID_SETTINGS_ROUTE_OPENED, route.openedAction)
      .putString(ANDROID_SETTINGS_ROUTE_COMPONENT, route.openedComponent.orEmpty())
      .putBoolean(ANDROID_SETTINGS_ROUTE_FALLBACK_USED, route.fallbackUsed)
      .putString(ANDROID_SETTINGS_ROUTE_ERROR, route.error.orEmpty())
      .putString(ANDROID_SETTINGS_ROUTE_OPENED_AT, route.openedAt)
      .apply()
  }

  private fun lastAndroidSettingsRoute(context: Context): AndroidSettingsRouteResult? {
    val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
    val action = prefs.getString(ANDROID_SETTINGS_ROUTE_OPENED, null)?.takeIf { it.isNotBlank() } ?: return null
    val component = prefs.getString(ANDROID_SETTINGS_ROUTE_COMPONENT, null)?.takeIf { it.isNotBlank() }
    val error = prefs.getString(ANDROID_SETTINGS_ROUTE_ERROR, null)?.takeIf { it.isNotBlank() }
    val openedAt = prefs.getString(ANDROID_SETTINGS_ROUTE_OPENED_AT, null)?.takeIf { it.isNotBlank() }
      ?: formatIsoMillis(System.currentTimeMillis())
    return AndroidSettingsRouteResult(
      openedAction = action,
      openedComponent = component,
      fallbackUsed = prefs.getBoolean(ANDROID_SETTINGS_ROUTE_FALLBACK_USED, false),
      error = error,
      openedAt = openedAt
    )
  }

  private fun appDetailsSettingsIntent(context: Context): Intent {
    return Intent(
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Uri.parse("package:${context.packageName}")
    )
  }

  private fun accessibilityServiceDetailsSettingsIntent(context: Context): Intent {
    return Intent(ACTION_ACCESSIBILITY_DETAILS_SETTINGS).apply {
      putExtra(Intent.EXTRA_COMPONENT_NAME, ComponentName(context, FreedAccessibilityService::class.java))
    }
  }

  private fun usageAccessSettingsIntent(context: Context): Intent {
    return Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}")).apply {
      putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
    }
  }

  private fun usageAccessConfigIntent(context: Context): Intent {
    return Intent(Intent.ACTION_MAIN).apply {
      addCategory(INTENT_CATEGORY_USAGE_ACCESS_CONFIG)
      component = ComponentName(context, FreedUsageAccessConfigActivity::class.java)
    }
  }

  private fun usageAccessConfigActivityName(context: Context): String {
    return ComponentName(context, FreedUsageAccessConfigActivity::class.java).flattenToString()
  }

  private fun androidNotificationSettingsIntent(context: Context): Intent {
    return Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
      putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    }
  }

  private fun isAndroidNotificationPermissionRequired(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
  }

  private fun isAndroidNotificationPermissionGranted(context: Context): Boolean {
    if (!isAndroidNotificationPermissionRequired()) return true
    return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  }

  @Suppress("DEPRECATION")
  private fun androidSettingsRouteComponent(intent: Intent): String? {
    return intent.component?.flattenToString()
      ?: intent.getParcelableExtra<ComponentName>(Intent.EXTRA_COMPONENT_NAME)?.flattenToString()
  }

  private fun androidSettingsRouteLabel(action: String): String {
    return when (action) {
      ACTION_ACCESSIBILITY_DETAILS_SETTINGS,
      Settings.ACTION_ACCESSIBILITY_SETTINGS -> "Accessibility"
      Settings.ACTION_USAGE_ACCESS_SETTINGS,
      INTENT_CATEGORY_USAGE_ACCESS_CONFIG -> "Usage Access"
      Settings.ACTION_APP_NOTIFICATION_SETTINGS -> "Notifications"
      ACTION_PRIVATE_DNS_SETTINGS,
      Settings.ACTION_WIRELESS_SETTINGS -> "Private DNS"
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS -> "FREED app settings"
      Settings.ACTION_SETTINGS -> "Android Settings"
      "android.net.VpnService.prepare" -> "DNS Guard VPN consent"
      else -> "Android settings"
    }
  }

  private fun androidSettingsRouteInstruction(action: String, fallbackUsed: Boolean): String {
    val fallbackPrefix = if (fallbackUsed) "Android opened a fallback screen. " else ""
    return fallbackPrefix + when (action) {
      ACTION_ACCESSIBILITY_DETAILS_SETTINGS,
      Settings.ACTION_ACCESSIBILITY_SETTINGS ->
        "Enable FREED Protection, review the Android disclosure, then return to FREED so setup can refresh automatically."
      Settings.ACTION_USAGE_ACCESS_SETTINGS,
      INTENT_CATEGORY_USAGE_ACCESS_CONFIG ->
        "Allow FREED Usage Access, then return to FREED so selected app timer checks can refresh automatically."
      Settings.ACTION_APP_NOTIFICATION_SETTINGS ->
        "Allow FREED notifications, then return to FREED so DNS Guard recovery challenge visibility can refresh."
      ACTION_PRIVATE_DNS_SETTINGS,
      Settings.ACTION_WIRELESS_SETTINGS ->
        "Review Private DNS, then return to FREED and run Test Protection so DNS Guard resolver behavior is verified."
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS ->
        "Open the needed FREED permission from app settings, then return to FREED so setup can continue."
      Settings.ACTION_SETTINGS ->
        "Search for the requested FREED permission, enable it, then return to FREED so setup can continue."
      "android.net.VpnService.prepare" ->
        "Approve FREED DNS Guard VPN consent, then return to FREED so DNS Guard can start automatically."
      else ->
        "Finish the opened Android settings step, then return to FREED so setup can refresh automatically."
    }
  }

  private fun settingsRouteMessage(
    route: AndroidSettingsRouteResult,
    primaryMessage: String,
    fallbackMessage: String,
    errorMessage: String
  ): String {
    if (route.error != null) return "$errorMessage ${route.error}"
    return if (route.fallbackUsed) fallbackMessage else primaryMessage
  }

  private fun getPrivateDnsMode(context: Context): String {
    val value = Settings.Global.getString(context.contentResolver, "private_dns_mode")
      ?.trim()
      ?.lowercase(Locale.US)
      .orEmpty()
    return when (value) {
      "", "off", "opportunistic", "hostname" -> if (value.isBlank()) "off" else value
      else -> "unknown"
    }
  }

  private fun getPrivateDnsSpecifier(context: Context): String? {
    val specifier = Settings.Global.getString(context.contentResolver, "private_dns_specifier")
      ?.trim()
      .orEmpty()
    return specifier.ifBlank { null }
  }

  private fun sanitizeBlockedAppPackages(packages: List<String>): List<String> {
    return packages
      .map { it.trim().lowercase(Locale.US) }
      .filter { it.matches(Regex("^[a-z0-9_]+(\\.[a-z0-9_]+)+$")) }
      .filter { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }
      .distinct()
      .take(SUPPORTED_BLOCKED_APP_PACKAGES.size)
  }

  private fun blockedApplicationCount(context: Context): Int {
    return configuredBlockedPackages(context).size
  }

  private fun configuredBlockedPackages(context: Context): List<String> {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, "")
      .orEmpty()
      .split(",")
      .map { it.trim().lowercase(Locale.US) }
      .filter { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }
      .distinct()
  }

  private fun sanitizeDailyLimitMinutes(value: Int?): Int {
    return (value ?: FreedAccessibilityService.DEFAULT_DAILY_LIMIT_MINUTES).coerceIn(5, 240)
  }

  private fun sanitizeShortFormThresholdSeconds(value: Int?): Int {
    return (value ?: FreedAccessibilityService.DEFAULT_SHORT_FORM_THRESHOLD_SECONDS).coerceIn(30, 300)
  }

  private fun configuredDailyLimitMinutes(context: Context): Int {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getInt(FreedAccessibilityService.DAILY_LIMIT_MINUTES, FreedAccessibilityService.DEFAULT_DAILY_LIMIT_MINUTES)
      .coerceIn(5, 240)
  }

  private fun configuredShortFormThresholdSeconds(context: Context): Int {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getInt(FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS, FreedAccessibilityService.DEFAULT_SHORT_FORM_THRESHOLD_SECONDS)
      .coerceIn(30, 300)
  }

  private fun activeEarnedUnlockExpiresAt(context: Context): String? {
    val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
    val expiresAt = prefs.getString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, null) ?: return null
    if (storedEarnedUnlockSourcePackage(prefs) == null) {
      clearEarnedUnlockPrefs(context)
      return null
    }

    val expiryMs = parseIsoMillis(expiresAt)
    val nowMs = System.currentTimeMillis()

    if (expiryMs != null && expiryMs > nowMs) {
      val maxExpiryMs = nowMs + FreedAccessibilityService.MAX_EARNED_UNLOCK_MINUTES * 60_000L
      if (expiryMs > maxExpiryMs) {
        val boundedExpiresAt = formatIsoMillis(maxExpiryMs)
        prefs.edit().putString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, boundedExpiresAt).apply()
        return boundedExpiresAt
      }
      return expiresAt
    }

    clearEarnedUnlockPrefs(context)
    return null
  }

  private fun activeUnlockSourcePackage(context: Context): String? {
    if (activeEarnedUnlockExpiresAt(context) == null) return null
    return storedEarnedUnlockSourcePackage(context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE))
  }

  private fun storedEarnedUnlockSourcePackage(prefs: SharedPreferences): String? {
    return prefs
      .getString(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE, null)
      ?.trim()
      ?.lowercase(Locale.US)
      ?.takeIf { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }
  }

  private fun clearEarnedUnlockPrefs(context: Context) {
    context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT)
      .remove(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE)
      .apply()
  }

  private fun isFreshPendingIntervention(detectedAt: String): Boolean {
    val detectedMs = parseIsoMillis(detectedAt) ?: return false
    val nowMs = System.currentTimeMillis()
    return detectedMs <= nowMs + PENDING_INTERVENTION_FUTURE_SKEW_MS &&
      nowMs - detectedMs <= PENDING_INTERVENTION_MAX_AGE_MS
  }

  private fun clearPendingInterventionPrefs(prefs: SharedPreferences) {
    prefs.edit()
      .remove(FreedAccessibilityService.PENDING_INTERVENTION_ID)
      .remove(FreedAccessibilityService.PENDING_URL)
      .remove(FreedAccessibilityService.PENDING_HOST)
      .remove(FreedAccessibilityService.PENDING_SOURCE_PACKAGE)
      .remove(FreedAccessibilityService.PENDING_REASON)
      .remove(FreedAccessibilityService.PENDING_RULE)
      .remove(FreedAccessibilityService.PENDING_FOCUS_SHIELD_RULE_ID)
      .remove(FreedAccessibilityService.PENDING_DETECTED_AT)
      .remove(FreedAccessibilityService.PENDING_SESSION_DURATION_SECONDS)
      .apply()
  }

  private fun claimPendingIntervention(prefs: SharedPreferences, expectedInterventionId: String): Boolean =
    synchronized(pendingInterventionClaimLock) {
      val currentInterventionId = sanitizedPendingInterventionId(
        prefs.getString(FreedAccessibilityService.PENDING_INTERVENTION_ID, null)
      )
      if (currentInterventionId != expectedInterventionId) {
        false
      } else if (isPendingInterventionConsumed(prefs, expectedInterventionId)) {
        false
      } else {
        markPendingInterventionConsumed(prefs, expectedInterventionId)
        true
      }
    }

  private fun markPendingInterventionConsumed(prefs: SharedPreferences, interventionId: String) {
    val consumedIds = pendingConsumedInterventionIds(prefs)
      .filterNot { it == interventionId }
      .plus(interventionId)
      .takeLast(MAX_PENDING_CONSUMED_INTERVENTION_IDS)
    prefs.edit().putString(PENDING_CONSUMED_INTERVENTION_IDS, consumedIds.joinToString(",")).commit()
  }

  private fun isPendingInterventionConsumed(prefs: SharedPreferences, interventionId: String): Boolean =
    pendingConsumedInterventionIds(prefs).contains(interventionId)

  private fun pendingConsumedInterventionIds(prefs: SharedPreferences): List<String> =
    prefs.getString(PENDING_CONSUMED_INTERVENTION_IDS, "")
      .orEmpty()
      .split(',')
      .mapNotNull(::sanitizedPendingInterventionId)
      .takeLast(MAX_PENDING_CONSUMED_INTERVENTION_IDS)

  private fun sanitizedPendingInterventionId(value: String?): String? {
    val normalized = value?.trim()?.lowercase(Locale.US).orEmpty()
    if (normalized.isBlank()) return null
    val parsed = runCatching { UUID.fromString(normalized) }.getOrNull() ?: return null
    return parsed.toString().takeIf { it == normalized }
  }

  private fun sanitizedPendingSessionDuration(pendingSnapshot: Map<String, *>): Long {
    return ((pendingSnapshot[FreedAccessibilityService.PENDING_SESSION_DURATION_SECONDS] as? Number)?.toLong() ?: 0L)
      .coerceIn(0L, 4 * 60 * 60L)
  }

  private fun packageForUnlockSourceHost(sourceAttemptHost: String?): String? {
    val rawSource = sourceAttemptHost
      ?.trim()
      ?.lowercase(Locale.US)
      .orEmpty()
    val strippedSource = rawSource
      .removePrefix("configured-app:")
      .removePrefix("short-form:")
    val shortFormRulePackage = FreedDoomscrollApps.packageForShortFormRule(rawSource)
    val normalizedHost = if (SUPPORTED_BLOCKED_APP_PACKAGES.contains(strippedSource)) {
      strippedSource
    } else {
      FreedUrlClassifier.normalizeHostForStorage(strippedSource)
    }

    val packageName = when {
      shortFormRulePackage != null -> shortFormRulePackage
      SUPPORTED_BLOCKED_APP_PACKAGES.contains(normalizedHost) -> normalizedHost
      FreedDoomscrollApps.packageForShortFormHost(normalizedHost) != null -> FreedDoomscrollApps.packageForShortFormHost(normalizedHost)
      normalizedHost.endsWith(FREED_APP_HOST_SUFFIX) -> normalizedHost.removeSuffix(FREED_APP_HOST_SUFFIX)
      else -> null
    }

    return packageName?.takeIf { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }
  }

  private fun sanitizedPendingHost(vararg values: String): String {
    values.forEach { value ->
      val host = FreedUrlClassifier.normalizeHostForStorage(value)
      if (host.isNotBlank()) return host
    }
    return "redacted.freed.local"
  }

  private fun sanitizedPendingSourcePackage(sourcePackage: String?, matchedRule: String): String {
    val normalized = sourcePackage
      ?.trim()
      ?.lowercase(Locale.US)
      ?.take(120)
      ?.takeIf { it.matches(Regex("^[a-z0-9_]+(\\.[a-z0-9_]+)+$")) || it == "android-dns" }
      .orEmpty()

    if (matchedRule.startsWith("configured-app:") || matchedRule.startsWith("short-form:") || matchedRule.startsWith("focus-shield:")) {
      return normalized.takeIf { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }.orEmpty()
    }

    return normalized
  }

  private fun parseIsoMillis(value: String): Long? {
    val formats = listOf(
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    )
    return formats.firstNotNullOfOrNull { pattern ->
      try {
        SimpleDateFormat(pattern, Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
        }.parse(value)?.time
      } catch (_: Exception) {
        null
      }
    }
  }

  private fun formatIsoMillis(value: Long): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(value))
  }

  private fun classifyChallengePhoto(
    context: Context,
    uri: String,
    expectedLabels: List<String>
  ): Map<String, Any> {
    val expected = expectedLabels.map(::normalizePhotoLabel).filter { it.isNotBlank() }
    if (expected.isEmpty()) {
      return photoClassificationPayload(
        available = false,
        matched = false,
        labels = emptyList(),
        matchedLabels = emptyList(),
        confidence = null,
        message = "This photo challenge has no verifiable target labels."
      )
    }

    val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
    return try {
      val image = InputImage.fromFilePath(context, Uri.parse(uri))
      val labels = Tasks.await(labeler.process(image), 8, TimeUnit.SECONDS)
      val labelTexts = labels.take(12).map { it.text }
      val matchingLabels = labels.filter { label ->
        val observed = normalizePhotoLabel(label.text)
        expected.any { target -> photoLabelMatches(observed, target) }
      }
      val matchedLabels = matchingLabels
        .filter { it.confidence.toDouble() >= PHOTO_MATCH_MIN_CONFIDENCE }
        .flatMap { label ->
          val observed = normalizePhotoLabel(label.text)
          if (expected.any { target -> photoLabelMatches(observed, target) }) listOf(observed) else emptyList()
        }
        .distinct()
        .sorted()
      val confidence = matchingLabels.maxOfOrNull { it.confidence.toDouble() }
      val confidentMatch = confidence != null && confidence >= PHOTO_MATCH_MIN_CONFIDENCE

      photoClassificationPayload(
        available = true,
        matched = matchedLabels.isNotEmpty() && confidentMatch,
        labels = labelTexts,
        matchedLabels = matchedLabels,
        confidence = confidence,
        message = if (matchingLabels.isEmpty()) {
          "No matching on-device image labels were found. Take a clearer photo of the target."
        } else if (!confidentMatch) {
          "The target label was too uncertain. Take a clearer photo with the target centered."
        } else {
          "Photo target verified on device."
        }
      )
    } catch (error: Exception) {
      photoClassificationPayload(
        available = true,
        matched = false,
        labels = emptyList(),
        matchedLabels = emptyList(),
        confidence = null,
        message = "FREED could not classify that image: ${error.localizedMessage ?: "unknown error"}"
      )
    } finally {
      labeler.close()
    }
  }

  private fun normalizePhotoLabel(value: String): String =
    value
      .lowercase(Locale.US)
      .replace(Regex("[^a-z0-9]+"), " ")
      .trim()
      .replace(Regex("\\s+"), " ")

  private fun photoLabelMatches(observed: String, expected: String): Boolean {
    if (observed.contains(expected) || expected.contains(observed)) return true
    val observedTokens = observed.split(" ").filter { it.isNotBlank() }.toSet()
    val expectedTokens = expected.split(" ").filter { it.isNotBlank() }.toSet()
    return observedTokens.intersect(expectedTokens).isNotEmpty()
  }

  private fun photoClassificationPayload(
    available: Boolean,
    matched: Boolean,
    labels: List<String>,
    matchedLabels: List<String>,
    confidence: Double?,
    message: String
  ): Map<String, Any> {
    val payload = mutableMapOf<String, Any>(
      "available" to available,
      "matched" to matched,
      "labels" to labels,
      "matchedLabels" to matchedLabels,
      "message" to message
    )
    if (confidence != null) payload["confidence"] = confidence
    return payload
  }
}
