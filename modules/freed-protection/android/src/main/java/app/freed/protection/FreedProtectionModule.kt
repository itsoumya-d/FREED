package app.freed.protection

import android.Manifest
import android.app.Activity
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
import androidx.activity.result.contract.ActivityResultContracts
import app.freed.protection.FreedDoomscrollApps.INSTAGRAM_PACKAGE
import app.freed.protection.FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
import app.freed.protection.FreedDoomscrollApps.YOUTUBE_PACKAGE
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.Date
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

private const val FREED_APP_HOST_SUFFIX = ".app.freed.local"
private const val PENDING_INTERVENTION_MAX_AGE_MS = 10 * 60 * 1000L
private const val PENDING_INTERVENTION_FUTURE_SKEW_MS = 60 * 1000L
private const val PENDING_CONSUMED_INTERVENTION_IDS = "pending_consumed_intervention_ids_v1"
private const val MAX_PENDING_CONSUMED_INTERVENTION_IDS = 32
private const val ACTION_PRIVATE_DNS_SETTINGS = "android.settings.PRIVATE_DNS_SETTINGS"
private const val ANDROID_SETTINGS_ROUTE_OPENED = "freed_android_settings_route_opened"
private const val ANDROID_SETTINGS_ROUTE_COMPONENT = "freed_android_settings_route_component"
private const val ANDROID_SETTINGS_ROUTE_FALLBACK_USED = "freed_android_settings_route_fallback_used"
private const val ANDROID_SETTINGS_ROUTE_ERROR = "freed_android_settings_route_error"
private const val ANDROID_SETTINGS_ROUTE_OPENED_AT = "freed_android_settings_route_opened_at"
private const val VPN_CONSENT_LAUNCH_ROUTE = "freed_vpn_consent_launch_route"
private const val VPN_CONSENT_REQUEST_CODE = 9407

class FreedProtectionModule : Module() {
  private val privateLease = FreedPrivateModuleLease { appContext.registry.getModule("FreedProtection") === this }
  private var ownedRuntimeCallback: (() -> Unit)? = null
  private fun denyLegacyPrivateTransport(): Unit { error("private-legacy-transport-unavailable") }
  private var pendingAdultConsentGeneration: Pair<Long?, Long>? = null
  @Volatile private var recoveryDnsForeground = false
  private val recoveryDnsForegroundCheck: () -> Boolean = {
    recoveryDnsForeground && appContext.currentActivity?.hasWindowFocus() == true && FreedPrivateAccountAdmission.live(privateLease)
  }
  private val photoPipeline = FreedChallengePhotoPipeline()
  private val earnedChallengeEvidence = FreedEarnedChallengeEvidenceController()
  private val pendingInterventionClaimLock = FreedNativeUnlockStore.lock

  override fun definition() = ModuleDefinition {
    Name("FreedProtection")

    Events("onVpnConsentResult", "onDnsGuardRuntimeChanged")

    Class(FreedAccountBindingSession::class) {
      Constructor { FreedPrivateAccountAdmission.construct(appContext, privateLease) }
    }
    Function("prepareAccountBindingV2") { session: FreedAccountBindingSession, rawScope: String, transitionUUID: String, sequence: Long ->
      val context = appContext.reactContext ?: return@Function mapOf("accepted" to false, "reason" to "private-runtime-unavailable")
      FreedPrivateAccountAdmission.prepare(context, privateLease, session, rawScope, transitionUUID, sequence)
    }
    Function("commitAccountBindingV2") { session: FreedAccountBindingSession, ticket: String ->
      val context = appContext.reactContext ?: return@Function mapOf("accepted" to false, "reason" to "private-runtime-unavailable")
      FreedPrivateAccountAdmission.commit(context, privateLease, session, ticket)
    }
    Function("prepareAccountProtectionCleanup") { scope: String, handle: String ->
      val context = appContext.reactContext ?: return@Function mapOf("accepted" to false)
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) mapOf("accepted" to false, "reason" to "private-session-stale")
      else FreedAppGroupStore.preparePrivateCleanup(context, scope, handle)
    }
    AsyncFunction("executeAccountProtectionCleanup") { operationID: String ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf("accepted" to false)
      FreedRetainedAdultProtection.execute(context, operationID, FreedPrivateAccountAdmission::cancelOriginalProcess)
    }
    AsyncFunction("getAccountProtectionCleanup") { operationID: String ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf("accepted" to false)
      FreedRetainedAdultProtection.status(context, operationID)
    }

    AsyncFunction("deviceAdultBridge") { command: String, request: Map<String, Any?> ->
      val context = appContext.reactContext
      if (context == null) mapOf("schema" to 1, "kind" to "error", "code" to "unavailable")
      else try { FreedAdultAuthorizationExecutor.get(context).deviceAdultBridge(command, request) }
      catch (_: Exception) { mapOf("schema" to 1, "kind" to "error", "code" to "unavailable") }
    }

    OnCreate {
      if (!FreedPrivateAccountAdmission.create(privateLease)) return@OnCreate
      recoveryDnsForeground = appContext.currentActivity?.hasWindowFocus() == true
      FreedRecoveryDnsPilotCoordinator.foreground = recoveryDnsForegroundCheck
      FreedPrivateAccountAdmission.registerProcessOwner(privateLease, earnedChallengeEvidence::cancelOriginalBinding)
      synchronized(FreedNativeUnlockStore.lock) {
        if (!FreedPrivateAccountAdmission.live(privateLease)) return@OnCreate
        appContext.reactContext?.let { earnedChallengeEvidence.initialize(it) }
        earnedChallengeEvidence.foreground(appContext.currentActivity?.hasWindowFocus() == true)
      }
      // Forward real tunnel start/stop transitions from the service to JS so the
      // wizard can react to actual runtime state instead of optimistic guesses.
      ownedRuntimeCallback = {
        runCatching {
          sendEvent(
            "onDnsGuardRuntimeChanged",
            mapOf(
              "running" to FreedVpnService.isRunning,
              "runtimeReady" to FreedVpnService.dnsGuardRuntimeReady,
              "adultFilterActive" to (appContext.reactContext?.let { dnsGuardFilteringActive(it) } ?: false),
              "dnsGuardCoverageReady" to (appContext.reactContext?.let { dnsGuardFilteringActive(it) } ?: false),
              "dnsGuardCaptivePaused" to FreedVpnService.dnsGuardCaptivePaused,
              "dnsGuardCoverageIssueCode" to (appContext.reactContext?.let { context ->
                FreedDnsGuardPolicy.issueCode(
                  FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, getPrivateDnsMode(context),
                  FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
                )
              } ?: ""),
              "dnsGuardIpv6MalformedPackets" to FreedVpnService.dnsGuardIpv6MalformedPackets.get(),
              "dnsGuardIpv6UnsupportedPackets" to FreedVpnService.dnsGuardIpv6UnsupportedPackets.get(),
              "dnsGuardIpv4ResolverRouteCount" to FreedVpnService.dnsGuardIpv4ResolverRouteCount,
              "dnsGuardIpv6ResolverRouteCount" to FreedVpnService.dnsGuardIpv6ResolverRouteCount,
              "stopReason" to FreedVpnService.dnsGuardLastStopReason,
              "stateVersion" to FreedVpnService.runtimeStateVersion,
              "adultGeneration" to appContext.reactContext?.let { FreedAdultProtectionState.generation(it) }
            )
          )
        }
      }
      synchronized(FreedNativeUnlockStore.lock) {
        if (FreedPrivateAccountAdmission.live(privateLease)) FreedVpnService.onRuntimeStateChanged = ownedRuntimeCallback
      }
    }

    OnActivityEntersForeground { earnedChallengeEvidence.foreground(true); recoveryDnsForeground = true }
    OnActivityEntersBackground {
      earnedChallengeEvidence.foreground(false); recoveryDnsForeground = false
      FreedRecoveryDnsPilotRouteCheck.invalidate()
    }

    OnDestroy {
      recoveryDnsForeground = false
      if (FreedRecoveryDnsPilotCoordinator.foreground === recoveryDnsForegroundCheck) {
        FreedRecoveryDnsPilotCoordinator.foreground = { false }
        FreedRecoveryDnsPilotRouteCheck.invalidate()
      }
      FreedPrivateAccountAdmission.destroy(privateLease)
      earnedChallengeEvidence.destroy()
      photoPipeline.destroy()
      FreedPrivateAccountAdmission.processDestroyed(privateLease)
      if (FreedVpnService.onRuntimeStateChanged === ownedRuntimeCallback) {
        FreedVpnService.onRuntimeStateChanged = null
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == VPN_CONSENT_REQUEST_CODE) {
        val context = appContext.reactContext ?: return@OnActivityResult
        val granted = payload.resultCode == Activity.RESULT_OK
        val pendingGeneration = pendingAdultConsentGeneration
        pendingAdultConsentGeneration = null
        if (granted && pendingGeneration != null && pendingGeneration == FreedAdultProtectionState.callbackEpoch(context) &&
          FreedVpnService.isUserEnabled(context)) {
          FreedVpnService.restartAfterSystemEvent(context, "consent-result")
        }
        // Report the user's decision immediately. The runtime event confirms
        // when the tunnel is ready without blocking Android's activity thread.
        sendEvent("onVpnConsentResult", mapOf(
          "granted" to granted,
          "vpnConsentRequired" to isVpnConsentRequired(context),
          "adultFilterActive" to (granted && dnsGuardFilteringActive(context))
        ))
      }
    }

    Function("setPresentationPreferences") { configuration: Map<String, String> ->
      val context = appContext.reactContext ?: return@Function false
      val language = configuration["language"] ?: return@Function false
      val themeMode = configuration["themeMode"] ?: return@Function false
      FreedNativeCopy.save(context, language, themeMode, configuration["languagePreference"])
    }

    AsyncFunction("getCapabilities") {
      val context = appContext.reactContext
      mapOf(
        "platform" to "android",
        "screenTime" to false,
        "managedSettings" to false,
        "accessibility" to true,
        "focusShieldSurfaceInspection" to (context != null && FreedFocusShieldRollout.buildAllowed(context)),
        "dnsFiltering" to true,
        "recoveryDnsPilot" to (context != null && FreedRecoveryDnsPilot.supported(context)),
        "usageStats" to true,
        "appSchedules" to true,
        "appGroups" to true,
        "installedApps" to true,
        "appGuardModes" to true,
        "localVpnFallback" to true,
        "notes" to listOf(
          "Accessibility service observes supported browser and focused WebView URL/search text only.",
          "Usage Access lets FREED cross-check selected app timers without reading in-app content.",
          "Configured app packages can be interrupted by Accessibility and UsageStats when the user opts in.",
          "App schedules use local time while Accessibility is connected, restore after service reconnect, and recheck on screen-on. Device sleep can delay checks; no exact wake alarm is used.",
          "Private DNS state is reported for QA because strict Private DNS can affect DNS Guard resolver behavior.",
          "Local VpnService fallback routes only configured DNS resolver IPs and never proxies full traffic."
        )
      )
    }

    AsyncFunction("getInstalledApplications") { scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) return@AsyncFunction emptyList<Map<String, Any?>>()
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) emptyList<Map<String, Any?>>() else {
        val applications = FreedInstalledApplications.list(context)
        applications.takeIf { FreedAppGroupStore.ownerScopeCurrent(scope) }.orEmpty()
      }
    }

    AsyncFunction("getInstalledGroupApps") { query: String, offset: Int, limit: Int, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) return@AsyncFunction mapOf("supported" to false, "apps" to emptyList<Any>(), "total" to 0)
      val context = appContext.reactContext ?: return@AsyncFunction mapOf("supported" to false, "apps" to emptyList<Any>(), "total" to 0, "nextOffset" to null, "reason" to "react-context-unavailable")
      val page = if (scope != null) FreedInstalledApplications.page(context, query, offset, limit) else null
      if (page != null && FreedAppGroupStore.ownerScopeCurrent(scope)) page else
        mapOf("supported" to true, "apps" to emptyList<Any>(), "total" to 0, "nextOffset" to null, "reason" to "app-group-signed-in-owner-required")
    }

    Function("suspendAppGroupOperations") { scope: String ->
      FreedPrivateAccountAdmission.suspend(privateLease, scope)
    }
    Function("setAppGroupActionScope") { scope: String ->
      mapOf("version" to 2, "accepted" to false, "reason" to "private-native-session-required")
    }

    AsyncFunction("getAppGroups") { scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.snapshot(context, scope)
    }

    AsyncFunction("createAppGroup") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.mutate(context, request, scope, "create")
    }

    AsyncFunction("discardPendingAppGroupSelection") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.discardPendingSelection(context, request, scope)
    }

    AsyncFunction("updateAppGroup") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.mutate(context, request, scope, "update")
    }

    AsyncFunction("updateAppGroupWithEarnedTime") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.updateWithEarnedTime(context, request, scope)
    }

    AsyncFunction("prepareEarnedAppTimeOffer") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedAppTimePolicy.rejectedOffer("earned-time-unavailable", false)
      FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, request, scope)
    }

    AsyncFunction("grantEarnedAppTimeBreak") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedAppTimePolicy.rejectedGrant("earned-time-unavailable", false)
      FreedAppGroupStore.grantEarnedTime(context, request, scope)
    }

    AsyncFunction("getEarnedAppTimeGrant") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedAppTimePolicy.rejectedGrant("earned-time-unavailable", false)
      FreedAppGroupStore.getEarnedTimeGrant(context, request, scope)
    }

    AsyncFunction("beginEarnedChallengeEvidence") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedChallengeProofPolicy.reply(supported = false)
      earnedChallengeEvidence.begin(context, request, scope)
    }
    AsyncFunction("setEarnedChallengeEvidencePhase") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedChallengeProofPolicy.reply(supported = false)
      earnedChallengeEvidence.phase(context, request, scope)
    }
    AsyncFunction("getEarnedChallengeEvidence") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedChallengeProofPolicy.reply(supported = false)
      earnedChallengeEvidence.get(context, request, scope)
    }
    AsyncFunction("finishEarnedChallengeEvidence") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedChallengeProofPolicy.reply(supported = false)
      earnedChallengeEvidence.finish(context, request, scope)
    }
    AsyncFunction("verifyEarnedChallengePhoto") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-unavailable")
      earnedChallengeEvidence.verify(context, request, scope)
    }
    AsyncFunction("captureEarnedChallengePhoto") { request: Map<String, Any?>, scope: String, promise: Promise ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      earnedChallengeEvidence.capture(appContext.reactContext, appContext.currentActivity, request, scope) { promise.resolve(it) }
    }

    AsyncFunction("removeAppGroup") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.mutate(context, request, scope, "remove")
    }

    AsyncFunction("presentAppGroupPicker") { request: Map<String, Any?>, scope: String, header: String, footer: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction null
      FreedAppGroupStore.unsupportedPicker(context, scope)
    }

    AsyncFunction("getEncryptedDnsStatus") {
      encryptedDnsStatus(appContext.reactContext)
    }

    AsyncFunction("stageRecoveryDnsPilot") { input: Map<String, Any?> ->
      FreedRecoveryDnsPilot.stage(appContext.reactContext, input, recoveryDnsForegroundCheck) {
        FreedPrivateAccountAdmission.valid(it, privateLease)
      }
    }
    AsyncFunction("prepareRecoveryDnsReplacement") { reference: String, actionScope: String ->
      FreedRecoveryDnsPilot.prepare(appContext.reactContext, reference, actionScope, recoveryDnsForegroundCheck,
        { FreedPrivateAccountAdmission.valid(it, privateLease) })
    }
    AsyncFunction("prepareRecoveryDnsModeActivation") { reference: String, actionScope: String ->
      FreedRecoveryDnsPilot.prepare(appContext.reactContext, reference, actionScope, recoveryDnsForegroundCheck,
        { FreedPrivateAccountAdmission.valid(it, privateLease) }, activation = true)
    }
    AsyncFunction("checkRecoveryDnsPilot") { reference: String, actionScope: String ->
      FreedRecoveryDnsPilot.check(appContext.reactContext, reference, actionScope, recoveryDnsForegroundCheck) {
        FreedPrivateAccountAdmission.valid(it, privateLease)
      }
    }
    AsyncFunction("getRecoveryDnsPilotStatus") { actionScope: String ->
      FreedRecoveryDnsPilot.status(appContext.reactContext, actionScope, recoveryDnsForegroundCheck) {
        FreedPrivateAccountAdmission.valid(it, privateLease)
      }
    }

    AsyncFunction("configureEncryptedDns") { configuration: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction encryptedDnsStatus(null)
      val enabled = configuration["enabled"] as? Boolean
        ?: return@AsyncFunction encryptedDnsStatus(context, "encrypted-dns-configuration-invalid")
      if (configuration["provider"] != "cloudflare-families") {
        return@AsyncFunction encryptedDnsStatus(context, "encrypted-dns-provider-unsupported")
      }
      if (enabled && !FreedEncryptedDnsConfig.capability(context).supported) {
        return@AsyncFunction encryptedDnsStatus(context)
      }
      // The lower writer owns adult -> grant ordering; a grant-first bridge wrapper
      // would deadlock against exact DNS replacement and protected repairs.
      val save = runCatching { FreedEncryptedDnsConfig.setRequested(context, enabled) }
      if (save.isFailure) return@AsyncFunction encryptedDnsStatus(context, FreedAdultMutationBoundary.reason(save.exceptionOrNull()))
      if (save.getOrDefault(false) != true) {
        return@AsyncFunction encryptedDnsStatus(context, "android-encrypted-dns-save-failed")
      }
      FreedVpnService.resetEncryptedDnsHealth()
      // Starting a second Android VPN replaces the first. Keep the user's
      // current VPN and Private DNS untouched and report the settings conflict.
      val privacy = FreedNetworkDnsState.read(context)
      if (enabled && privacy.mode == "off" && !encryptedDnsOtherVpnActive(context) &&
        !isVpnConsentRequired(context)) {
        val started = runCatching { FreedVpnService.startUserEnabledGuard(context) }
        if (started.isFailure) return@AsyncFunction encryptedDnsStatus(context, "android-encrypted-dns-start-failed")
      }
      encryptedDnsStatus(context)
    }

    AsyncFunction("getStatus") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val enabled = isAccessibilityServiceEnabled(context)
      val interceptionEnabled = FreedProtectionConfiguration.interceptionEnabled(context)
      val vpnActive = dnsGuardFilteringActive(context)
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
        active = (enabled && interceptionEnabled) || vpnActive,
        mode = if (enabled) "accessibility" else "dns",
        message = if (!interceptionEnabled) "FREED interception is disabled. Device permission settings are unchanged." else protectionStatusMessage(
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
        vpnConsentLaunchRoute = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
          .getString(VPN_CONSENT_LAUNCH_ROUTE, null),
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
        adultDomainFeedDomainCount = FreedAdultDomainFeed.domainCount(context),
        userAllowedDomainCount = FreedAdultDomainFeed.userAllowedDomainCount(context)
      ).let {
        redactPrivateAppDiagnostics(suppressBreakEvidenceWhileHardGuarded(context, it + appScheduleStatusPayload(context)), usageStatsSnapshot?.privateOwnerScope)
      }
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
        Settings.ACTION_ACCESSIBILITY_SETTINGS,
        listOf(appDetailsSettingsIntent(context), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android Accessibility settings. Choose FREED Protection under downloaded or installed services, enable it, approve Android's request, then return to FREED.",
          "Opened an Android settings fallback. Go to Accessibility > downloaded or installed services > FREED Protection, enable it, then return to FREED.",
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
          appDetailsSettingsIntent(context)
        )
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = "accessibility",
        message = if (route.openedAction == Settings.ACTION_APPLICATION_DETAILS_SETTINGS) {
          "Usage Access could not open, so FREED app info is open instead. App info cannot enable this permission. Go to Android Settings > Special app access > Usage access > FREED, allow access, then return to FREED."
        } else settingsRouteMessage(
          route,
          "Opened Usage Access for FREED. Turn on Allow usage access, then return to FREED.",
          "Opened the Android Usage Access list. Select FREED, turn on Allow usage access, then return to FREED.",
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
        androidSettingsRouteInstruction = if (route.openedAction == Settings.ACTION_APPLICATION_DETAILS_SETTINGS) {
          "App info cannot enable Usage Access. Open Android Settings > Special app access > Usage access > FREED, allow access, then return to FREED."
        } else androidSettingsRouteInstruction(route.openedAction, route.fallbackUsed),
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

    AsyncFunction("openVpnSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      // This is connection-conflict recovery. FREED's approval still comes only
      // from the VpnService.prepare dialog in applyAdultContentFilter.
      val route = openAndroidSettingsRoute(
        context,
        Settings.ACTION_VPN_SETTINGS,
        listOf(
          Intent(Settings.ACTION_SETTINGS)
        )
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (FreedVpnService.isRunning) "dns" else "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android VPN settings. Disconnect another VPN or review its always-on setting, then return to FREED and retry the connection request.",
          "Opened Android settings fallback. Go to Network & internet > VPN, review any conflicting VPN, then return to FREED and retry the connection request.",
          "Android VPN settings could not open. Go to Android Settings > Network & internet > VPN, review any conflicting VPN, then return to FREED."
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

    AsyncFunction("applyAdultContentFilter") {
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      if (!FreedProtectionConfiguration.interceptionEnabled(context)) {
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context), active = false, mode = "dns",
          message = "Adult protection needs attention: the legacy protection configuration is disabled. Restore app configuration separately before retrying."
        ))
      }
      val adultRepair = runCatching {
        val classifierRepair = runCatching { FreedAdultProtectionState.setAccessibility(context, true) }
        // A separate intent journal failure must not suppress a monotone DNS repair.
        FreedVpnService.setUserEnabled(context, true)
        check(classifierRepair.getOrThrow()) { "adult-classifier-repair-unconfirmed" }
      }
      if (adultRepair.isFailure) return@AsyncFunction adultMutationFailurePayload(context, adultRepair.exceptionOrNull())
      val privacy = FreedNetworkDnsState.read(context)
      if (!FreedDnsGuardPolicy.allowsPlaintext(privacy.mode)) {
        if (FreedVpnService.isRunning) {
          context.stopService(Intent(context, FreedVpnService::class.java))
        }
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context),
          active = false,
          mode = "dns",
          message = FreedDnsGuardPolicy.message(privacy.mode),
          adultFilterActive = false,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = isVpnConsentRequired(context)
        ))
      }

      val prepareIntent = VpnService.prepare(context)
      if (prepareIntent != null) {
        // Pending Android consent is observation, not an in-app adult disable.
        // Try the proper activity-result path first (gets a callback when user taps OK/Deny)
        val launcherRoute = runCatching {
          val activity = appContext.currentActivity
            ?: throw IllegalStateException("no-current-activity")
          pendingAdultConsentGeneration = FreedAdultProtectionState.callbackEpoch(context)
          activity.startActivityForResult(prepareIntent, VPN_CONSENT_REQUEST_CODE)
        }
        var consentOpened = launcherRoute.isSuccess
        var consentLaunchRoute = if (consentOpened) "activity-result" else "failed"
        val consentAction = prepareIntent.action ?: "android.net.VpnService.prepare"
        val consentError = launcherRoute.exceptionOrNull()?.localizedMessage
          ?: launcherRoute.exceptionOrNull()?.javaClass?.simpleName

        // If the launcher failed (e.g. no registered activity host), try startActivity directly
        if (!consentOpened) {
          val directRoute = runCatching {
            val activity = appContext.currentActivity
            if (activity != null) {
              activity.startActivity(prepareIntent)
            } else {
              val taskIntent = Intent(prepareIntent).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
              }
              context.startActivity(taskIntent)
            }
          }
          consentOpened = directRoute.isSuccess
          if (consentOpened) consentLaunchRoute = "direct"
        }

        // Last resort: open FREED's app details settings (NOT VPN settings, since
        // FREED won't appear in VPN settings until consent is already granted)
        var fallbackRoute: AndroidSettingsRouteResult? = null
        if (!consentOpened) {
          fallbackRoute = openAndroidSettingsRoute(
            context,
            appDetailsSettingsIntent(context),
            listOf(
              Intent(Settings.ACTION_SETTINGS)
            )
          )
          consentOpened = fallbackRoute.error == null
          consentLaunchRoute = if (fallbackRoute.error == null) "app-details-fallback" else "failed"
        }
        val route = fallbackRoute ?: AndroidSettingsRouteResult(
          openedAction = consentAction,
          openedComponent = null,
          fallbackUsed = false,
          error = consentError,
          openedAt = formatIsoMillis(System.currentTimeMillis())
        )
        persistAndroidSettingsRoute(context, route)
        context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
          .edit()
          .putString(VPN_CONSENT_LAUNCH_ROUTE, consentLaunchRoute)
          .apply()
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = false,
          active = false,
          mode = "dns",
          message = when (consentLaunchRoute) {
            "activity-result", "direct" ->
              "The Android VPN approval dialog should be on screen now. Tap OK so FREED can start DNS Guard, which routes DNS resolver IPs only for adult-domain blocking."
            "app-details-fallback" ->
              "The VPN dialog could not open, so FREED opened its app info page instead. Return and tap Start DNS Guard again; if it keeps failing, restart the phone and try once more."
            else ->
              "Android VPN consent could not be opened. Tap Start DNS Guard again, or restart the app and try once more."
          },
          adultFilterActive = false,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = true,
          vpnConsentLaunchRoute = consentLaunchRoute,
          androidSettingsRoutes = androidSettingsRoutes(),
          androidSettingsRouteOpened = route.openedAction,
          androidSettingsRouteComponent = route.openedComponent,
          androidSettingsFallbackUsed = route.fallbackUsed,
          androidSettingsRouteError = route.error,
          androidSettingsRouteOpenedAt = route.openedAt
        ))
      }

      FreedVpnService.restartAfterSystemEvent(context, "adult-repair")

      // Allow establish() to finish synchronously if quick, avoiding race with RN
      var attempts = 0
      while (!FreedVpnService.dnsGuardRuntimeReady && attempts < 8) {
        runCatching { Thread.sleep(50) }
        attempts++
      }

      val runtimeReady = FreedVpnService.dnsGuardRuntimeReady
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = true,
        active = runtimeReady,
        mode = "dns",
        message = if (runtimeReady) {
          "FREED DNS Guard is running with DNS-only adult-domain filtering."
        } else {
          "Starting FREED DNS Guard… The tunnel comes up in a moment."
        },
        adultFilterActive = runtimeReady,
        dnsGuardRuntimeReady = runtimeReady,
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

      val stop = FreedVpnService.requestAdultStop(context)
      val observedActive = dnsGuardFilteringActive(context)
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = true,
        active = observedActive,
        mode = "dns",
        message = if (stop["runtimeStopped"] == true) "FREED DNS Guard stopped."
          else "FREED could not confirm DNS Guard stopped. Protection needs attention.",
        adultFilterActive = observedActive,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes()
      )) + mapOf("adultMutationReceipt" to stop)
    }

    AsyncFunction("resetProtectionConfiguration") {
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false, active = false, mode = "accessibility", message = "React context is unavailable."
      ) + mapOf("protectionConfigurationResetAccepted" to false, "protectionConfigurationResetError" to "react-context-unavailable")
      val result = FreedProtectionConfiguration.reset(context)
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context), active = !result.accepted && dnsGuardFilteringActive(context), mode = "accessibility",
        adultFilterActive = !result.accepted && dnsGuardFilteringActive(context),
        message = if (result.accepted) "FREED protection configuration and temporary access were cleared. Device permission settings are unchanged."
          else "FREED could not confirm complete protection cleanup. Local deletion must wait; retry the reset."
      )).toMutableMap().apply {
        put("protectionConfigurationResetAccepted", result.accepted)
        result.errorCode?.let { put("protectionConfigurationResetError", it) }
      }
    }

    AsyncFunction("activateProtectionConfiguration") {
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false, active = false, mode = "accessibility", message = "React context is unavailable."
      ) + mapOf("protectionConfigurationActivationAccepted" to false)
      val accepted = FreedProtectionConfiguration.activate(context)
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context), active = false, mode = "accessibility",
        message = if (accepted) "FREED protection configuration is enabled. Device permission settings are unchanged."
          else "FREED protection configuration could not be enabled. Retry activation."
      )).toMutableMap().apply { put("protectionConfigurationActivationAccepted", accepted) }
    }

    AsyncFunction("configureBlockedAppPackages") { packages: List<String>, dailyLimitMinutes: Int?, shortFormInterruptionSeconds: Int? ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val sanitized = FreedInstalledAppPolicy.validateSelection(packages, FreedInstalledApplications.eligible(context))
        ?: return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context), active = isAccessibilityServiceEnabled(context), mode = "accessibility",
          message = "App selection was rejected because a package is invalid, unavailable or part of a critical system pathway."
        )).toMutableMap().apply { put("appConfigurationAccepted", false) }
      val sanitizedDailyLimit = sanitizeDailyLimitMinutes(dailyLimitMinutes ?: configuredDailyLimitMinutes(context))
      val sanitizedShortFormThreshold = sanitizeShortFormThresholdSeconds(shortFormInterruptionSeconds)

      val selectionAccepted = synchronized(FreedNativeUnlockStore.lock) {
        if (!FreedProtectionConfiguration.interceptionEnabled(context)) return@synchronized false
        val storage = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
        val before = storage.all
        val epoch = FreedProtectionConfiguration.epoch(context)
        val keys = listOf(FreedAccessibilityService.BLOCKED_APP_PACKAGES, FreedAccessibilityService.DAILY_LIMIT_MINUTES,
          FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS)
        val editor = storage.edit().putString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, sanitized.joinToString(","))
          .putInt(FreedAccessibilityService.DAILY_LIMIT_MINUTES, sanitizedDailyLimit)
          .putInt(FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS, sanitizedShortFormThreshold)
        FreedAppGroupTransaction.publish({ editor.commit() }, {
          storage.getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, null) == sanitized.joinToString(",") &&
            storage.getInt(FreedAccessibilityService.DAILY_LIMIT_MINUTES, -1) == sanitizedDailyLimit &&
            storage.getInt(FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS, -1) == sanitizedShortFormThreshold
        }, { FreedProtectionConfiguration.interceptionEnabled(context) && epoch == FreedProtectionConfiguration.epoch(context) }, {
          val rollback = storage.edit()
          keys.forEach { key -> when (val value = before[key]) { is String -> rollback.putString(key, value)
            is Int -> rollback.putInt(key, value); else -> rollback.remove(key) } }
          rollback.commit()
        })
      }
      val usageStatsSnapshot = queryConfiguredUsageStats(context)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (!selectionAccepted) {
          "App selection was rejected; the prior acknowledged native policy is retained."
        } else if (sanitized.isEmpty()) {
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
        blockedApplications = blockedApplicationCount(context),
        dailyLimitMinutes = sanitizedDailyLimit,
        shortFormInterruptionSeconds = sanitizedShortFormThreshold,
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        activeUnlockExpiresAt = activeEarnedUnlockExpiresAt(context)
      )).toMutableMap().apply { put("appConfigurationAccepted", selectionAccepted) }
    }

    AsyncFunction("configureAppGuardMode") { mode: String ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false, active = false, mode = "accessibility", message = "React context is unavailable."
      ) + mapOf("appGuardModeConfigurationAccepted" to false, "appGuardReady" to false)
      val result = FreedAppGuardModeStore.save(context, mode)
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context), active = false, mode = "accessibility",
        message = protectionStatusMessage(isAccessibilityServiceEnabled(context), dnsGuardFilteringActive(context),
          getPrivateDnsMode(context), FreedVpnService.isUserEnabled(context), FreedVpnService.isAutoRestartEligible(context), isVpnConsentRequired(context))
      )).toMutableMap().apply {
        put("appGuardModeConfigurationAccepted", result.accepted)
        result.error?.let { put("appGuardModeConfigurationError", it) }
      }
    }

    AsyncFunction("configureAppSchedules") { configuration: Map<String, Any?> ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      ) + mapOf("appSchedulesConfigurationAccepted" to false)
      val result = FreedAppScheduleStore.save(context, configuration)
      val connected = FreedAccessibilityService.appSchedulesServiceConnected
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = connected || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = when {
          !result.accepted -> "App schedule configuration was rejected. Previous protection settings stay unchanged."
          !FreedAppScheduleStore.read(context).configured -> "App schedules are off. Manual app limits stay configured separately."
          !connected -> "App schedules are saved. Connect FREED Accessibility to enforce them."
          else -> "App schedules are saved and the Accessibility service is connected. Local-time windows are checked on app events and while the screen is on."
        }
      )).toMutableMap().apply {
        put("appSchedulesConfigurationAccepted", result.accepted)
        result.error?.let { put("appSchedulesConfigurationError", it) }
      }
    }

    AsyncFunction("configureAdultDomainFeed") { domains: List<String>, version: String, checksum: String, generatedAt: String ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      val save = runCatching { synchronized(FreedNativeUnlockStore.lock) {
        FreedAdultDomainFeed.configure(context, domains, version, checksum, generatedAt)
      } }
      if (save.isFailure) return@AsyncFunction adultMutationFailurePayload(context, save.exceptionOrNull())

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (FreedProtectionConfiguration.interceptionEnabled(context)) "Adult-domain feed ${FreedAdultDomainFeed.version(context) ?: "configured"} synced to native protection."
          else "Adult-domain feed is saved; FREED protection needs activation.",
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

    AsyncFunction("configureUserAllowedDomains") { domains: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "dns",
        message = "React context is unavailable."
      )

      val save = runCatching { synchronized(FreedNativeUnlockStore.lock) {
        FreedAdultDomainFeed.configureUserAllowedDomains(context, domains)
      } }
      if (save.isFailure) return@AsyncFunction adultMutationFailurePayload(context, save.exceptionOrNull())
      val allowed = save.getOrThrow()

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (FreedProtectionConfiguration.interceptionEnabled(context)) "Always-allow list saved with ${allowed.size} domain${if (allowed.size == 1) "" else "s"}."
          else "Always-allow list is saved; FREED protection needs activation.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        userAllowedDomainCount = allowed.size
      ))
    }

    AsyncFunction("configureFocusShieldRollout") { enabled: Boolean ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false, active = false, mode = "accessibility", message = "React context is unavailable."
      )
      FreedFocusShieldRollout.configure(context, enabled)
      if (!FreedFocusShieldRollout.enabled(context)) FreedFocusShieldCalibrationBridge.cancel()
      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context), active = isAccessibilityServiceEnabled(context),
        mode = "accessibility", message = "Focus Shield rollout status refreshed."
      ))
    }

    AsyncFunction("startFocusShieldCalibration") { request: Map<String, Any?> ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction FreedFocusShieldCalibrationBridge.failStart(
        "React context is unavailable, so calibration cannot start."
      )
      if (!FreedFocusShieldRollout.enabled(context)) {
        return@AsyncFunction FreedFocusShieldCalibrationBridge.failStart("Android selected surface inspection is release-gated pending policy and device validation.")
      }
      if (!isAccessibilityServiceEnabled(context)) {
        return@AsyncFunction FreedFocusShieldCalibrationBridge.permissionRevoked()
      }
      FreedFocusShieldCalibrationBridge.start(request)
    }

    AsyncFunction("cancelFocusShieldCalibration") {
      denyLegacyPrivateTransport()
      FreedFocusShieldCalibrationBridge.cancel()
    }

    AsyncFunction("getFocusShieldCalibration") {
      denyLegacyPrivateTransport()
      val context = appContext.reactContext
      if (context != null && !isAccessibilityServiceEnabled(context)) {
        FreedFocusShieldCalibrationBridge.permissionRevoked()
      } else {
        FreedFocusShieldCalibrationBridge.get()
      }
    }

    AsyncFunction("configureFocusShieldRule") { rule: Map<String, Any?> ->
      denyLegacyPrivateTransport()
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
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      FreedFocusShieldRules.list(context).map(FreedFocusShieldRule::toPayload)
    }

    AsyncFunction("removeFocusShieldRule") { ruleId: String ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction false
      FreedFocusShieldRules.remove(context, ruleId)
    }

    AsyncFunction("applyFocusShieldEarnedUnlock") { expiresAt: String, scope: Map<String, Any?>, nativeInterventionId: String? ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val kind = scope["kind"] as? String
      val ruleId = scope["ruleId"] as? String
      val packageName = scope["packageName"] as? String
      val expiryMs = parseIsoMillis(expiresAt)
      val authority = synchronized(FreedNativeUnlockStore.lock) {
        if (kind == "android-surface" && ruleId != null && packageName != null && expiryMs != null &&
          isAccessibilityServiceEnabled(context) && FreedFocusShieldRollout.enabled(context) && !hardAppGuardActive(context, packageName)) {
          FreedNativeUnlockStore.fulfill(context, sanitizedPendingInterventionId(nativeInterventionId), packageName, ruleId, expiryMs)
        } else null
      }
      val boundedExpiresAt = if (authority?.firstFulfillment == true && ruleId != null && packageName != null) {
        FreedFocusShieldRules.applySurfaceUnlock(context, formatIsoMillis(authority.expiresAtMs), ruleId, packageName)
      } else if (authority != null) {
        FreedFocusShieldRules.activeSurfaceUnlocks(context).firstOrNull {
          it.ruleId == ruleId && it.packageName == packageName && it.expiryMs == authority.expiresAtMs
        }?.expiresAt
      } else null

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
      )).toMutableMap().apply {
        put("nativeUnlockGrantAccepted", boundedExpiresAt != null && !hardAppGuardActive(context, packageName))
        sanitizedPendingInterventionId(nativeInterventionId)?.let { put("nativeUnlockGrantInterventionId", it) }
      }
    }

    AsyncFunction("grantResetAppGroupBreak") { request: Map<String, Any?>, scope: String ->
      if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) throw IllegalStateException("private-session-stale")
      val context = appContext.reactContext ?: return@AsyncFunction FreedResetAppGroupRewardPolicy.rejected("reset-reward-unavailable", false)
      FreedAppGroupStore.grantResetReward(context, request, scope)
    }

    AsyncFunction("applyEarnedUnlockWindow") { expiresAt: String, sourceAttemptHost: String?, nativeInterventionId: String? ->
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val nowMs = System.currentTimeMillis()
      val expiryMs = parseIsoMillis(expiresAt)
      if (expiryMs == null || expiryMs <= nowMs) {
        return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
          authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
          mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
          message = "Earned unlock request was rejected. Current protection and valid unlocks stay unchanged.",
          adultFilterActive = FreedVpnService.isRunning,
          appInterventionAuthorized = isAccessibilityServiceEnabled(context),
          usageStatsAuthorized = isUsageStatsAuthorized(context),
          vpnConsentRequired = isVpnConsentRequired(context),
          androidSettingsRoutes = androidSettingsRoutes()
        ))
      }

      val groupSource = sourceAttemptHost?.takeIf(FreedInstalledAppPolicy::validPackage)
      if (groupSource != null) {
        val groupGrant = FreedAppGroupStore.fulfill(context, sanitizedPendingInterventionId(nativeInterventionId), groupSource, expiryMs)
        if (groupGrant != null) {
          return@AsyncFunction statusPayloadWithAndroidDiagnostics(context, statusPayload(
            authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
            active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
            mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
            message = "Native group break accepted for the claimed target.", adultFilterActive = FreedVpnService.isRunning,
            appInterventionAuthorized = isAccessibilityServiceEnabled(context), usageStatsAuthorized = isUsageStatsAuthorized(context)
          )).toMutableMap().apply {
            groupGrant.forEach { (key, value) -> if (value != null) put(key, value) }
            if (groupGrant["appGroupBreakEffective"] != true) {
              listOf("activeUnlockExpiresAt", "activeUnlockSourcePackage", "activeUnlockInterventionId").forEach(::remove)
              put("accessReady", false); put("paused", false)
            }
          }
        }
      }

      val sourcePackage = FreedAppGuardModePolicy.packageSource(sourceAttemptHost)
      if (sourcePackage == null) {
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

      val authority = synchronized(FreedNativeUnlockStore.lock) {
        if (isAccessibilityServiceEnabled(context) && sourcePackage in configuredBlockedPackages(context)) {
          if (hardAppGuardActive(context, sourcePackage)) null else FreedNativeUnlockStore.fulfill(context,
            sanitizedPendingInterventionId(nativeInterventionId), sourcePackage, null, expiryMs)
        } else null
      }

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (authority != null && activeEarnedUnlockExpiresAt(context) != null) "Earned unlock window is active. Adult-domain filtering stays protected."
          else "Earned unlock request was rejected. Current protection and valid unlocks stay unchanged.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes(),
        activeUnlockExpiresAt = activeEarnedUnlockExpiresAt(context),
        activeUnlockSourcePackage = activeUnlockSourcePackage(context)
      )).toMutableMap().apply {
        val id = sanitizedPendingInterventionId(nativeInterventionId)
        val accepted = authority != null && id != null && isAccessibilityServiceEnabled(context) &&
          !hardAppGuardActive(context, sourcePackage) &&
          FreedNativeUnlockStore.hasActivePackageGrant(context, sourcePackage, authority.expiresAtMs, id)
        put("nativeUnlockGrantAccepted", accepted)
        id?.let { put("nativeUnlockGrantInterventionId", it) }
      }
    }

    AsyncFunction("clearEarnedUnlockWindow") {
      denyLegacyPrivateTransport()
      val context = appContext.reactContext ?: return@AsyncFunction statusPayload(
        authorized = false,
        active = false,
        mode = "accessibility",
        message = "React context is unavailable."
      )
      val groupBreakCleared = FreedAppGroupStore.clearEarnedBreaks(context)
      clearEarnedUnlockPrefs(context)

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        active = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
        mode = if (isAccessibilityServiceEnabled(context)) "accessibility" else "dns",
        message = if (groupBreakCleared) "Earned unlock cleared. FREED protection is active again."
          else "Native group break cancellation could not be confirmed; check current group protection status.",
        adultFilterActive = FreedVpnService.isRunning,
        appInterventionAuthorized = isAccessibilityServiceEnabled(context),
        usageStatsAuthorized = isUsageStatsAuthorized(context),
        vpnConsentRequired = isVpnConsentRequired(context),
        androidSettingsRoutes = androidSettingsRoutes()
      )).toMutableMap().apply { put("appGroupBreakClearAccepted", groupBreakCleared) }
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
        Settings.ACTION_ACCESSIBILITY_SETTINGS,
        listOf(appDetailsSettingsIntent(context), Intent(Settings.ACTION_SETTINGS))
      )

      statusPayloadWithAndroidDiagnostics(context, statusPayload(
        authorized = isAccessibilityServiceEnabled(context),
        active = isAccessibilityServiceEnabled(context),
        mode = "accessibility",
        message = settingsRouteMessage(
          route,
          "Opened Android Accessibility settings. Choose FREED Protection under downloaded or installed services, enable it, approve Android's request, then return to FREED.",
          "Opened an Android settings fallback. Go to Accessibility > downloaded or installed services > FREED Protection, enable it, then return to FREED.",
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

    AsyncFunction("getPendingIntervention") { scope: String ->
      synchronized(FreedNativeUnlockStore.lock) {
        val context = appContext.reactContext ?: return@AsyncFunction null
        if (!FreedProtectionConfiguration.interceptionEnabled(context)) return@AsyncFunction null
        val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
        if (!FreedPrivateAccountAdmission.valid(scope, privateLease)) return@AsyncFunction null
        val pendingSnapshot = prefs.all
        if (FreedWebsiteRecoveryHandoff.isWebsite(pendingSnapshot) &&
          !FreedWebsiteRecoveryHandoff.current(context, pendingSnapshot, pendingSnapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] as? String)) return@AsyncFunction null
        val storedUrl = pendingSnapshot[FreedAccessibilityService.PENDING_URL] as? String ?: return@AsyncFunction null
        val interventionId = sanitizedPendingInterventionId(
          pendingSnapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] as? String
        ) ?: return@AsyncFunction null
        if (isPendingInterventionConsumed(prefs, interventionId)) return@AsyncFunction null
        val detectedAt = pendingSnapshot[FreedAccessibilityService.PENDING_DETECTED_AT] as? String ?: ""

        if (!isFreshPendingIntervention(detectedAt)) {
          claimPendingIntervention(prefs, interventionId, stageUnlockLease = false)
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
        if ((matchedRule.startsWith("configured-app:") || matchedRule.startsWith("short-form:") || matchedRule.startsWith("focus-shield:")) &&
          sourcePackage !in FreedInstalledApplications.eligible(context)) {
          claimPendingIntervention(prefs, interventionId, stageUnlockLease = false)
          return@AsyncFunction null
        }
        if (matchedRule.startsWith("app-group:") && FreedAppGroupStore.awaitingOwnerBinding()) return@AsyncFunction null
        val groupScope = if (matchedRule.startsWith("app-group:")) FreedAppGroupStore.pendingScope(context, pendingSnapshot) else null
        if ((matchedRule.startsWith("app-group:") && groupScope == null) ||
          ((matchedRule.startsWith("configured-app:") || matchedRule.startsWith("short-form:") || matchedRule.startsWith("focus-shield:")) && sourcePackage.isBlank())) {
          claimPendingIntervention(prefs, interventionId, stageUnlockLease = false)
          return@AsyncFunction null
        }

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
          if (groupScope != null) put("scope", groupScope)
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
    }

    AsyncFunction("clearPendingIntervention") { expectedInterventionId: String, scope: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      val sanitizedExpectedInterventionId = sanitizedPendingInterventionId(expectedInterventionId)
        ?: return@AsyncFunction false
      synchronized(FreedNativeUnlockStore.lock) {
        FreedPrivateAccountAdmission.valid(scope, privateLease) && claimPendingIntervention(prefs, sanitizedExpectedInterventionId)
      }
    }

    AsyncFunction("getChallengePhotoCapabilities") {
      val context = appContext.reactContext
      photoPipeline.capabilities(context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) == true)
    }
    AsyncFunction("classifyChallengePhoto") { uri: String, expectedLabels: List<String>, operationId: String, promise: Promise ->
      denyLegacyPrivateTransport()
      photoPipeline.classify(appContext.reactContext, uri, expectedLabels, operationId, promise)
    }
    AsyncFunction("cancelChallengePhoto") { operationId: String -> denyLegacyPrivateTransport(); photoPipeline.cancel(operationId) }

  }

  private fun adultMutationFailurePayload(context: Context, failure: Throwable?): Map<String, Any> =
    statusPayloadWithAndroidDiagnostics(context, statusPayload(
      authorized = isAccessibilityServiceEnabled(context) || FreedVpnService.isRunning,
      active = dnsGuardFilteringActive(context), mode = "dns",
      message = "FREED could not authorize or confirm this adult-protection change.",
      adultFilterActive = dnsGuardFilteringActive(context)
    )) + mapOf("adultMutationAccepted" to false, "adultMutationError" to FreedAdultMutationBoundary.reason(failure))

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
    val todayMinutesByPackage: Map<String, Int>,
    val privateOwnerScope: String?
  )

  private fun queryConfiguredUsageStats(context: Context): UsageStatsSnapshot? {
    val capturedScope: String? = null
    if (capturedScope == null) return null
    if (!isUsageStatsAuthorized(context)) return null
    val packages = configuredBlockedPackages(context)
    if (packages.isEmpty()) {
      return UsageStatsSnapshot(
        observedPackages = 0,
        observedPackageNames = emptyList(),
        todayMinutes = 0,
        todayMinutesByPackage = emptyMap(),
        privateOwnerScope = capturedScope
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
      observedPackageNames = observedPackageNames.takeIf { FreedAppGroupStore.ownerScopeCurrent(capturedScope) }.orEmpty(),
      todayMinutes = (totalMs / 60_000L).coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
      todayMinutesByPackage = todayMinutesByPackage.takeIf { FreedAppGroupStore.ownerScopeCurrent(capturedScope) }.orEmpty(),
      privateOwnerScope = capturedScope
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
    val userAllowed = FreedAdultDomainFeed.userAllowedDomains(context)
    val adultClassification = FreedUrlClassifier.classify("https://$adultHost", domains, userAllowed)
    val normalClassification = FreedUrlClassifier.classify("https://$normalHost", domains, userAllowed)
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

    val coverageIssue = FreedDnsGuardPolicy.issueCode(
      FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, privateDnsMode,
      FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
    )
    if (coverageIssue != null && coverageIssue != "android-dns-guard-not-running") {
      issues += if (coverageIssue == "android-ipv6-dns-format-unsupported")
        "DNS Guard runtime is not ready."
        else if (FreedVpnService.dnsGuardCaptivePaused && privateDnsMode == "off")
        "Adult-domain filtering is paused for network sign-in. Finish sign-in and test again."
        else FreedDnsGuardPolicy.message(privateDnsMode)
      issueCodes += coverageIssue
    }

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
    val result = mutableMapOf<String, Any>(
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
      "dnsGuardCoverageReady" to dnsGuardFilteringActive(context),
      "dnsGuardCoverageIssueCode" to (coverageIssue ?: ""),
      "dnsGuardCaptivePaused" to FreedVpnService.dnsGuardCaptivePaused,
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
    when (privateDnsMode) {
      "off" -> result["privateDnsActive"] = false
      "hostname", "opportunistic" -> result["privateDnsActive"] = true
    }
    return redactPrivateAppDiagnostics(result, usageStatsSnapshot?.privateOwnerScope)
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
    val enriched = payload.filterKeys { it !in setOf("usageStatsObservedPackageNames", "usageStatsTodayMinutesByPackage", "activeAppScheduleIds",
        "activeUnlockSourcePackage", "activeUnlockInterventionId", "activeFocusShieldUnlockPackageName", "activeFocusShieldUnlockRuleId",
        "activeFocusShieldUnlockInterventionId") }.toMutableMap()
    val usageStatsSnapshot = queryConfiguredUsageStats(context)
    val accessibilityEnabled = isAccessibilityServiceEnabled(context)
    val dnsGuardActive = dnsGuardFilteringActive(context)
    val dnsGuardAutoRestartEligible = FreedVpnService.isAutoRestartEligible(context)
    val lastSettingsRoute = lastAndroidSettingsRoute(context)

    fun putIfMissing(key: String, value: Any?) {
      if (!enriched.containsKey(key) && value != null) {
        enriched[key] = value
      }
    }

    enriched["authorized"] = accessibilityEnabled || dnsGuardActive || dnsGuardAutoRestartEligible
    enriched["active"] = (accessibilityEnabled && FreedProtectionConfiguration.interceptionEnabled(context)) || dnsGuardActive
    enriched["mode"] = if (accessibilityEnabled) "accessibility" else if (dnsGuardActive) "dns" else (enriched["mode"] ?: "dns")
    enriched["adultFilterActive"] = dnsGuardActive
    if (FreedVpnService.lastAdultStopReceipt.isNotEmpty()) enriched["adultMutationReceipt"] = FreedVpnService.lastAdultStopReceipt
    enriched["adultProtectionNeedsAttention"] = FreedVpnService.isUserEnabled(context) && !dnsGuardActive
    enriched["adultLockEnrollmentAvailable"] = false
    enriched["adultProtectionLayers"] = FreedAdultProtectionState.status(context, accessibilityEnabled, FreedAccessibilityService.appSchedulesServiceConnected)
    enriched.putAll(appScheduleStatusPayload(context))
    putIfMissing("appInterventionAuthorized", accessibilityEnabled)
    putIfMissing("usageStatsAuthorized", isUsageStatsAuthorized(context))
    putIfMissing("usageStatsObservedPackages", usageStatsSnapshot?.observedPackages)
    putIfMissing("usageStatsObservedPackageNames", usageStatsSnapshot?.observedPackageNames)
    putIfMissing("usageStatsTodayMinutes", usageStatsSnapshot?.todayMinutes)
    putIfMissing("usageStatsTodayMinutesByPackage", usageStatsSnapshot?.todayMinutesByPackage)
    putIfMissing("blockedApplications", blockedApplicationCount(context))
    putIfMissing("dailyLimitMinutes", configuredDailyLimitMinutes(context))
    putIfMissing("shortFormInterruptionSeconds", configuredShortFormThresholdSeconds(context))
    enriched["focusShieldSurfaceReleaseEnabled"] = FreedFocusShieldRollout.releaseEnabled(context)
    enriched["focusShieldSurfaceEnabled"] = FreedFocusShieldRollout.enabled(context)
    enriched["focusShieldSurfaceReason"] = FreedFocusShieldRollout.reason(context, accessibilityEnabled)
    val focusShieldSnapshot = FreedFocusShieldRules.snapshot(context)
    putIfMissing("focusShieldRuleCount", focusShieldSnapshot.rules.size)
    putIfMissing("focusShieldEnabledRuleCount", focusShieldSnapshot.enabledCount)
    putIfMissing("focusShieldRuleStoreHealth", focusShieldSnapshot.health)
    putIfMissing("activeFocusShieldUnlockExpiresAt", FreedFocusShieldRules.activeSurfaceUnlockExpiresAt(context))
    putIfMissing("activeFocusShieldUnlockRuleId", FreedFocusShieldRules.activeSurfaceUnlockRuleId(context))
    putIfMissing("activeFocusShieldUnlockPackageName", FreedFocusShieldRules.activeSurfaceUnlockPackage(context))
    putIfMissing("activeUnlockExpiresAt", activeEarnedUnlockExpiresAt(context))
    putIfMissing("activeUnlockSourcePackage", activeUnlockSourcePackage(context))
    // UUID evidence comes from a native fulfilled receipt for the exact reported
    // target/expiry, never from a JS history record or a health boolean.
    enriched.remove("activeUnlockInterventionId")
    enriched.remove("activeFocusShieldUnlockInterventionId")
    if (accessibilityEnabled) {
      val source = enriched["activeUnlockSourcePackage"] as? String
      val expiry = (enriched["activeUnlockExpiresAt"] as? String)?.let(::parseIsoMillis)
      if (source != null && expiry != null) FreedNativeUnlockStore.activePackageInterventionId(context, source, expiry)
        ?.let { enriched["activeUnlockInterventionId"] = it }
      val surfacePackage = enriched["activeFocusShieldUnlockPackageName"] as? String
      val surfaceRule = enriched["activeFocusShieldUnlockRuleId"] as? String
      val surfaceExpiry = (enriched["activeFocusShieldUnlockExpiresAt"] as? String)?.let(::parseIsoMillis)
      if (FreedFocusShieldRollout.enabled(context) && surfacePackage != null && surfaceRule != null && surfaceExpiry != null)
        FreedNativeUnlockStore.activeSurfaceInterventionId(context, surfacePackage, surfaceRule, surfaceExpiry)
          ?.let { enriched["activeFocusShieldUnlockInterventionId"] = it }
    }
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
    putIfMissing("privateDnsActive", FreedNetworkDnsState.read(context).active)
    enriched["dnsGuardCoverageReady"] = dnsGuardActive
    enriched["dnsGuardCoverageIssueCode"] = FreedDnsGuardPolicy.issueCode(
      FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, getPrivateDnsMode(context),
      FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
    ) ?: ""
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
    enriched["dnsGuardIpv6MalformedPackets"] = FreedVpnService.dnsGuardIpv6MalformedPackets.get()
    enriched["dnsGuardIpv6UnsupportedPackets"] = FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
    enriched["dnsGuardIpv4ResolverRouteCount"] = FreedVpnService.dnsGuardIpv4ResolverRouteCount
    enriched["dnsGuardIpv6ResolverRouteCount"] = FreedVpnService.dnsGuardIpv6ResolverRouteCount
    putIfMissing("dnsGuardRuntimeReady", FreedVpnService.dnsGuardRuntimeReady)
    putIfMissing("dnsGuardRuntimeIssue", FreedVpnService.dnsGuardRuntimeIssue)
    putIfMissing("dnsGuardUserEnabled", FreedVpnService.isUserEnabled(context))
    putIfMissing("dnsGuardAutoRestartEligible", dnsGuardAutoRestartEligible)
    putIfMissing("dnsGuardLastAutoRestartAction", FreedVpnService.lastAutoRestartAction(context))
    putIfMissing("dnsGuardLastAutoRestartAt", FreedVpnService.lastAutoRestartAt(context))
    putIfMissing("dnsGuardLastAutoRestartResult", FreedVpnService.lastAutoRestartResult(context))
    putIfMissing("dnsGuardLastAutoRestartSkipReason", FreedVpnService.lastAutoRestartSkipReason(context))
    putIfMissing("dnsGuardCaptivePaused", FreedVpnService.dnsGuardCaptivePaused)
    putIfMissing("dnsGuardNetworkResolverCount", FreedVpnService.networkResolverCount())
    putIfMissing("dnsGuardAvgForwardMs", FreedVpnService.dnsGuardAvgForwardMs)
    putIfMissing("dnsGuardDroppedQueries", FreedVpnService.dnsGuardDroppedQueries.get())
    putIfMissing("dnsGuardTcpFastFails", FreedVpnService.dnsGuardTcpFastFails.get())
    putIfMissing("dnsGuardNetworkFallbackHits", FreedVpnService.dnsGuardNetworkFallbackHits.get())
    putIfMissing("otherVpnActive", isOtherVpnTransportActive(context))
    putIfMissing("alwaysOnVpnPackage", readAlwaysOnVpnPackage(context))
    putIfMissing("fullScreenIntentsEnabled", canUseFullScreenIntents(context))
    putIfMissing("adultDomainFeedVersion", FreedAdultDomainFeed.version(context))
    putIfMissing("adultDomainFeedChecksum", FreedAdultDomainFeed.checksum(context))
    putIfMissing("adultDomainFeedDomainCount", FreedAdultDomainFeed.domainCount(context))
    putIfMissing("userAllowedDomainCount", FreedAdultDomainFeed.userAllowedDomainCount(context))

    return redactPrivateAppDiagnostics(suppressBreakEvidenceWhileHardGuarded(context, enriched), usageStatsSnapshot?.privateOwnerScope)
  }

  /** Keep generic coverage/counts public while fencing target-specific data at final publication. */
  private fun redactPrivateAppDiagnostics(payload: Map<String, Any>, capturedScope: String?): Map<String, Any> =
    if (FreedAppGroupStore.ownerScopeCurrent(capturedScope)) payload else payload.filterKeys {
      it !in setOf("usageStatsObservedPackageNames", "usageStatsTodayMinutesByPackage")
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
    vpnConsentLaunchRoute: String? = null,
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
    adultDomainFeedDomainCount: Int? = null,
    userAllowedDomainCount: Int? = null
  ): Map<String, Any> {
    val payload = mutableMapOf<String, Any>(
      "authorized" to authorized,
      "active" to active,
      "mode" to mode,
      "message" to message
    )
    payload.putAll(mapOf(
      "appSchedulesSupported" to true,
      "appSchedulesConfigured" to false,
      "appSchedulesServiceConnected" to false,
      "activeAppScheduleIds" to emptyList<String>(),
      "activeAppSchedulePackageCount" to 0
    ))
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
    if (vpnConsentLaunchRoute != null) payload["vpnConsentLaunchRoute"] = vpnConsentLaunchRoute
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
    if (userAllowedDomainCount != null) payload["userAllowedDomainCount"] = userAllowedDomainCount
    appContext.reactContext?.let { context ->
      val privacy = FreedNetworkDnsState.read(context)
      val coverageReady = FreedDnsGuardPolicy.filteringActive(
        FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, privacy.mode,
        FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
      )
      payload["dnsGuardCoverageReady"] = coverageReady
      payload["dnsGuardCoverageIssueCode"] = FreedDnsGuardPolicy.issueCode(
        FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, privacy.mode,
        FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
      ) ?: ""
      payload["dnsGuardCaptivePaused"] = FreedVpnService.dnsGuardCaptivePaused
      payload["dnsGuardIpv6MalformedPackets"] = FreedVpnService.dnsGuardIpv6MalformedPackets.get()
      payload["dnsGuardIpv6UnsupportedPackets"] = FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
      payload["dnsGuardIpv4ResolverRouteCount"] = FreedVpnService.dnsGuardIpv4ResolverRouteCount
      payload["dnsGuardIpv6ResolverRouteCount"] = FreedVpnService.dnsGuardIpv6ResolverRouteCount
      privacy.active?.let { payload["privateDnsActive"] = it }
      payload["privateDnsMode"] = privacy.mode
      privacy.serverName?.let { payload["privateDnsSpecifier"] = it }
      payload["adultFilterActive"] = adultFilterActive == true && coverageReady
      if (!coverageReady && appInterventionAuthorized != true) payload["active"] = false
    }
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
    val privateDnsNote = if (!FreedDnsGuardPolicy.allowsPlaintext(privateDnsMode)) {
      " " + FreedDnsGuardPolicy.message(privateDnsMode)
    } else if (FreedVpnService.dnsGuardCaptivePaused) {
      " Adult-domain filtering is paused for network sign-in. Finish sign-in, then test protection again."
    } else {
      ""
    }

    return if (accessibilityEnabled) {
      "FREED Accessibility protection is enabled for supported browsers, focused WebView fields, and opted-in app timers.$privateDnsNote"
    } else if (!FreedDnsGuardPolicy.allowsPlaintext(privateDnsMode)) {
      FreedDnsGuardPolicy.message(privateDnsMode)
    } else if (FreedVpnService.dnsGuardCaptivePaused) {
      "DNS Guard is running, but adult-domain filtering is paused for network sign-in. Finish sign-in, then test protection again."
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
      Settings.ACTION_APP_NOTIFICATION_SETTINGS,
      ACTION_PRIVATE_DNS_SETTINGS,
      Settings.ACTION_ACCESSIBILITY_SETTINGS,
      Settings.ACTION_USAGE_ACCESS_SETTINGS,
      Settings.ACTION_VPN_SETTINGS,
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

  private fun usageAccessSettingsIntent(context: Context): Intent {
    return Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}")).apply {
      putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
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
      Settings.ACTION_ACCESSIBILITY_SETTINGS -> "Accessibility"
      Settings.ACTION_USAGE_ACCESS_SETTINGS -> "Usage Access"
      Settings.ACTION_APP_NOTIFICATION_SETTINGS -> "Notifications"
      ACTION_PRIVATE_DNS_SETTINGS,
      Settings.ACTION_WIRELESS_SETTINGS -> "Private DNS"
      Settings.ACTION_VPN_SETTINGS -> "VPN settings"
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS -> "FREED app settings"
      Settings.ACTION_SETTINGS -> "Android Settings"
      "android.net.VpnService.prepare" -> "DNS Guard VPN consent"
      else -> "Android settings"
    }
  }

  private fun androidSettingsRouteInstruction(action: String, fallbackUsed: Boolean): String {
    val fallbackPrefix = if (fallbackUsed) "Android opened a fallback screen. " else ""
    return fallbackPrefix + when (action) {
      Settings.ACTION_ACCESSIBILITY_SETTINGS ->
        "Choose FREED Protection under downloaded or installed services, turn it on, approve Android's request, then return to FREED."
      Settings.ACTION_USAGE_ACCESS_SETTINGS ->
        "Select FREED if a list appears, turn on Allow usage access, then return to FREED so app timers can refresh automatically."
      Settings.ACTION_APP_NOTIFICATION_SETTINGS ->
        "Allow FREED notifications, then return to FREED so DNS Guard recovery challenge visibility can refresh."
      ACTION_PRIVATE_DNS_SETTINGS,
      Settings.ACTION_WIRELESS_SETTINGS ->
        "Review Private DNS, then return to FREED and run Test Protection so DNS Guard resolver behavior is verified."
      Settings.ACTION_VPN_SETTINGS ->
        "Review any conflicting VPN or always-on VPN, then return to FREED and retry its connection request. Approve FREED in the system dialog it opens."
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS ->
        "FREED app info is open. If the requested special permission is not listed, use its page in Android Settings, then return to FREED."
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
    return FreedNetworkDnsState.read(context).mode
  }

  private fun encryptedDnsOtherVpnActive(context: Context): Boolean {
    val alwaysOn = runCatching { readAlwaysOnVpnPackage(context) }.getOrNull()
    return (alwaysOn != null && alwaysOn != context.packageName) || isOtherVpnTransportActive(context)
  }

  private fun encryptedDnsStatus(context: Context?, error: String? = null): Map<String, Any?> {
    if (context == null) return mapOf(
      "supported" to false, "releaseEnabled" to false, "configured" to false, "enabled" to false,
      "healthy" to null, "reason" to "native-context-unavailable", "provider" to "cloudflare-families",
      "requiresSettings" to false
    )
    val capability = FreedEncryptedDnsConfig.capability(context)
    val pilot = FreedRecoveryDnsPilot.activeOrUnknown(context)
    return FreedEncryptedDnsPolicy.status(
      supported = capability.supported || (pilot && FreedRecoveryDnsPilot.supported(context)),
      releaseEnabled = capability.releaseEnabled && !pilot,
      configured = FreedEncryptedDnsConfig.isRequested(context) || pilot, running = FreedVpnService.dnsGuardRuntimeReady,
      privateDnsMode = FreedNetworkDnsState.read(context).mode,
      otherVpnActive = encryptedDnsOtherVpnActive(context), consentRequired = isVpnConsentRequired(context),
      captivePaused = FreedVpnService.dnsGuardCaptivePaused, healthy = FreedVpnService.encryptedDnsHealthy(), error = error
    ) + mapOf("provider" to if (pilot) FreedRecoveryDnsPilotPolicy.PROVIDER else "cloudflare-families")
  }

  private fun getPrivateDnsSpecifier(context: Context): String? {
    return FreedNetworkDnsState.read(context).serverName
  }

  private fun dnsGuardFilteringActive(context: Context): Boolean = FreedDnsGuardPolicy.filteringActive(
    FreedVpnService.isRunning, FreedVpnService.dnsGuardCaptivePaused, getPrivateDnsMode(context),
    FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()
  )

  private fun isOtherVpnTransportActive(context: Context): Boolean {
    if (FreedVpnService.isRunning) return false
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
      ?: return false
    return runCatching {
      manager.allNetworks.any { network ->
        val capabilities = manager.getNetworkCapabilities(network) ?: return@any false
        capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_VPN)
      }
    }.getOrDefault(false)
  }

  private fun readAlwaysOnVpnPackage(context: Context): String? {
    val alwaysOnPackage = Settings.Secure.getString(context.contentResolver, "always_on_vpn_app")
      ?.trim()
      .orEmpty()
    return alwaysOnPackage.ifBlank { null }
  }

  private fun canUseFullScreenIntents(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
      ?: return true
    return runCatching { manager.canUseFullScreenIntent() }.getOrDefault(true)
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

  private fun appScheduleStatusPayload(context: Context): Map<String, Any> {
    val configuration = FreedAppScheduleStore.read(context)
    val now = System.currentTimeMillis()
    val snapshot = FreedAppSchedulePolicy.evaluate(configuration, now)
    val enabled = FreedProtectionConfiguration.interceptionEnabled(context)
    val connected = FreedAccessibilityService.appSchedulesServiceConnected
    val eligible = FreedInstalledApplications.eligible(context)
    val manual = staticBlockedPackages(context).toSet().intersect(eligible)
    val mode = FreedAppGuardModeStore.read(context)
    val selectedWindows = configuration.schedules.any { it.effective && it.packages.any(manual::contains) }
    return mutableMapOf<String, Any>(
      "protectionConfigurationResetDisabled" to !enabled,
      "appGuardMode" to mode,
      "appGuardReady" to (FreedAppGuardModeStore.valid(context) && FreedAppGuardModePolicy.ready(mode, manual.size, enabled,
        isAccessibilityServiceEnabled(context), connected, isUsageStatsAuthorized(context), selectedWindows)),
      "strictAppGuardEnabled" to configuration.strictGuard,
      "strictAppGuardActive" to (configuration.strictGuard && enabled && connected && isAccessibilityServiceEnabled(context)),
      "appSchedulesSupported" to true,
      "appSchedulesConfigured" to configuration.configured,
      "appSchedulesServiceConnected" to connected,
      "activeAppScheduleIds" to snapshot.activeScheduleIds,
      "activeAppSchedulePackageCount" to snapshot.activePackages.intersect(eligible).size
    ).apply {
      FreedAppSchedulePolicy.nextBoundaryAt(configuration, now)?.let { boundary ->
        put("nextAppScheduleBoundaryAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date(boundary)))
      }
    }
  }

  private fun hardAppGuardActive(context: Context, packageName: String?): Boolean {
    if (packageName != null && packageName !in FreedInstalledApplications.eligible(context)) return false
    val configuration = FreedAppScheduleStore.read(context)
    return FreedAppGuardModePolicy.hardGuardActive(packageName,
      FreedAppSchedulePolicy.evaluate(configuration, System.currentTimeMillis()), configuration.strictGuard) ||
      (packageName != null && FreedAppGroupStore.blockingGroup(context, packageName) != null)
  }

  private fun suppressBreakEvidenceWhileHardGuarded(context: Context, payload: Map<String, Any>): Map<String, Any> {
    // Hide only the effective evidence for each guarded target, without changing any stored receipt.
    val packageSource = payload["activeUnlockSourcePackage"] as? String ?: storedEarnedUnlockSourcePackage(
      context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE))
    val surfaceSource = payload["activeFocusShieldUnlockPackageName"] as? String
    val suppressed = mutableSetOf<String>()
    if (hardAppGuardActive(context, packageSource)) suppressed.addAll(setOf(
      "activeUnlockExpiresAt", "activeUnlockSourcePackage", "activeUnlockInterventionId"))
    if (hardAppGuardActive(context, surfaceSource)) suppressed.addAll(setOf(
      "activeFocusShieldUnlockExpiresAt", "activeFocusShieldUnlockRuleId", "activeFocusShieldUnlockPackageName",
      "activeFocusShieldUnlockInterventionId"))
    return payload.filterKeys { it !in suppressed }
  }

  private fun staticBlockedPackages(context: Context): List<String> = context
    .getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
    .getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, "").orEmpty().split(",")
    .map { it.trim().lowercase(Locale.US) }.filter { FreedInstalledAppPolicy.validPackage(it) && it != context.packageName }.distinct()

  private fun configuredBlockedPackages(context: Context): List<String> {
    val configuration = FreedAppScheduleStore.read(context)
    val manual = staticBlockedPackages(context).toSet()
    val independent = if (configuration.strictGuard) SUPPORTED_BLOCKED_APP_PACKAGES else emptySet()
    val eligible = FreedInstalledApplications.eligible(context)
    return (FreedAppSchedulePolicy.effectivePackages(manual, FreedAppScheduleStore.snapshot(context)) + independent)
      .filter { it != context.packageName && it in eligible }
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

  private fun activeEarnedUnlockExpiresAt(context: Context): String? = synchronized(FreedNativeUnlockStore.lock) {
    val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
    if (hardAppGuardActive(context, storedEarnedUnlockSourcePackage(prefs))) return@synchronized null
    val expiresAt = prefs.getString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, null) ?: return@synchronized null
    if (storedEarnedUnlockSourcePackage(prefs) == null) {
      clearEarnedUnlockPrefs(context)
      return@synchronized null
    }

    val expiryMs = parseIsoMillis(expiresAt)
    val nowMs = System.currentTimeMillis()

    val sourcePackage = storedEarnedUnlockSourcePackage(prefs)
    if (expiryMs != null && expiryMs > nowMs && sourcePackage != null && FreedNativeUnlockStore.hasActivePackageGrant(context, sourcePackage, expiryMs)) {
      val maxExpiryMs = nowMs + FreedAccessibilityService.MAX_EARNED_UNLOCK_MINUTES * 60_000L
      if (expiryMs > maxExpiryMs) {
        val boundedExpiresAt = formatIsoMillis(maxExpiryMs)
        prefs.edit().putString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, boundedExpiresAt).apply()
        return@synchronized boundedExpiresAt
      }
      return@synchronized expiresAt
    }

    clearEarnedUnlockPrefs(context)
    return@synchronized null
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
    val editor = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE).edit()
      .remove(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT).remove(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE)
    FreedNativeUnlockStore.clearPackageReceipt(editor)
    editor.apply()
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

  private fun claimPendingIntervention(prefs: SharedPreferences, expectedInterventionId: String, stageUnlockLease: Boolean = true): Boolean =
    synchronized(pendingInterventionClaimLock) {
      val snapshot = prefs.all
      if (FreedWebsiteRecoveryHandoff.isWebsite(snapshot)) {
        val context = appContext.reactContext ?: return@synchronized false
        if (!FreedWebsiteRecoveryHandoff.current(context, snapshot, expectedInterventionId)) return@synchronized false
      }
      if (FreedAppGroupStore.awaitingOwnerBinding() &&
        (snapshot[FreedAccessibilityService.PENDING_RULE] as? String)?.startsWith("app-group:") == true) return@synchronized false
      val currentInterventionId = sanitizedPendingInterventionId(
        snapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] as? String
      )
      if (currentInterventionId != expectedInterventionId) {
        false
      } else if (isPendingInterventionConsumed(prefs, expectedInterventionId)) {
        false
      } else {
        val editor = prefs.edit()
        val consumedIds = pendingConsumedInterventionIds(prefs).filterNot { it == expectedInterventionId }.plus(expectedInterventionId).takeLast(MAX_PENDING_CONSUMED_INTERVENTION_IDS)
        editor.putString(PENDING_CONSUMED_INTERVENTION_IDS, consumedIds.joinToString(","))
        val context = appContext.reactContext
        if (stageUnlockLease && context != null && !FreedWebsiteRecoveryHandoff.isWebsite(snapshot)) {
          FreedNativeUnlockStore.stage(context, snapshot, editor)
          FreedAppGroupStore.stage(context, snapshot, editor)
        }
        if (editor.commit()) true else {
          val rollback = prefs.edit()
          (snapshot[PENDING_CONSUMED_INTERVENTION_IDS] as? String)?.let { rollback.putString(PENDING_CONSUMED_INTERVENTION_IDS, it) }
            ?: rollback.remove(PENDING_CONSUMED_INTERVENTION_IDS)
          if (stageUnlockLease && !FreedWebsiteRecoveryHandoff.isWebsite(snapshot)) {
            FreedNativeUnlockStore.restoreClaimedLease(rollback, snapshot)
            FreedAppGroupStore.restoreClaim(rollback, snapshot)
          }
          rollback.apply()
          false
        }
      }
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
      ?.takeIf { it.length <= 255 }
      ?.takeIf { it.matches(Regex("^[a-z0-9_]+(\\.[a-z0-9_]+)+$")) || it == "android-dns" }
      .orEmpty()

    if (matchedRule.startsWith("configured-app:")) {
      return normalized.takeIf { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) && matchedRule.removePrefix("configured-app:") == it }.orEmpty()
    }
    if (matchedRule.startsWith("short-form:")) {
      val expected = FreedDoomscrollApps.packageForShortFormRule(matchedRule)
      return normalized.takeIf { it == expected || (expected == FreedDoomscrollApps.TIKTOK_PRIMARY_PACKAGE && it in FreedDoomscrollApps.TIKTOK_PACKAGES) }.orEmpty()
    }
    if (matchedRule.startsWith("focus-shield:")) {
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

}
