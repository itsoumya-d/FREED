package app.freed.protection

import android.content.Context
import android.content.MemoryPreferences
import android.app.NotificationManager

fun retainedCleanupCases() {
  fun seed(token:String):Context {
    val context=Context()
    context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
    check(FreedAppGroupStore.bindScope(context,token))
    FreedWebsiteRecoveryHandoff.pending=FreedWebsiteRecoveryHandoff.Stamp(token)
    context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]="private-groups"
    context.storage.values["pending_intervention_id"]="private-intervention"
    context.storage.values["native_package_unlock_receipt_v1"]="private-grant"
    context.storage.values["app_group_earned_time_budgets_v2"]="private-budget"
    context.storage.values[FreedAccessibilityService.BLOCKED_APP_PACKAGES]="org.reader"
    context.storage.values[FreedAccessibilityService.APP_USAGE_PREFIX+"org.reader"]=42L
    context.storage.values["adult_domain_feed_domains"]="adult.example"
    context.storage.values["user_allowed_domains"]="exception.example"
    context.storage.values["dns_guard_user_enabled"]=true
    context.storage.values["protection_interception_disabled_v1"]=false
    (context.getSharedPreferences("freed_encrypted_dns",0) as MemoryPreferences).values["cloudflare_families_enabled"]=true
    (context.getSharedPreferences("protected-lock-file-fixture",0) as MemoryPreferences).values["sealed_record"]="retained-device-bytes"
    return context
  }
  val token="[\"cleanup-owner-A\",812]";val operation="cleanup_operation_A_812"
  var context=seed(token)
  val retained=context.storage.values.filterKeys{!FreedRetainedAdultProtection.privateKey(it)}
  val encrypted=context.getSharedPreferences("freed_encrypted_dns",0).all
  val protected=context.getSharedPreferences("protected-lock-file-fixture",0).all
  check(FreedAppGroupStore.suspendPrivateOperations())
  val cleaned=FreedAppGroupStore.clearPrivateRetainingAdult(context,token,operation)
  check(cleaned["accepted"]==true && cleaned["replay"]==false)
  check(FreedWebsiteRecoveryHandoff.pending==null)
  check(context.storage.values==retained)
  check(context.getSharedPreferences("freed_encrypted_dns",0).all==encrypted)
  check(context.getSharedPreferences("protected-lock-file-fixture",0).all==protected)
  check(FreedVpnService.running)
  val notifications=context.services[Context.NOTIFICATION_SERVICE] as NotificationManager
  check(notifications.cancelled==listOf(9403,9404) && 9402 !in notifications.cancelled)
  check(!FreedAppGroupStore.ownerBound())
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,token,operation)["replay"]==true)
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,token,"different_operation_812")["accepted"]==false)
  // Exact native scope rebind after erased metadata still permits the tombstone retry.
  check(FreedAppGroupStore.bindScope(context,token))
  context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]="recreated-private-authority"
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,token,operation)["reason"]=="private-cleanup-authority-recreated")
  check(context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]=="recreated-private-authority")
  context.storage.values.remove(FreedAppGroupStore.CONFIGURATION_KEY)
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,token,operation)["replay"]==true)
  val newToken="[\"cleanup-owner-B\",813]"
  check(FreedAppGroupStore.bindScope(context,newToken))
  context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]="new-owner-private"
  val before=context.storage.values.toMap()
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,token,operation)["accepted"]==false)
  check(context.storage.values==before)
  // A new owner's matching operation ID cannot replay the deleted owner's receipt.
  val newOwner=FreedAppGroupStore.clearPrivateRetainingAdult(context,newToken,operation)
  check(newOwner["accepted"]==true && newOwner["replay"]==false)

  val retryToken="[\"cleanup-retry-owner\",814]";val retryOp="cleanup_operation_retry_814"
  context=seed(retryToken)
  val retryNotifications=context.services[Context.NOTIFICATION_SERVICE] as NotificationManager
  retryNotifications.fail=true
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,retryToken,retryOp)["accepted"]==false)
  check(context.storage.values.keys.none(FreedRetainedAdultProtection::privateKey))
  check(context.storage.values["dns_guard_user_enabled"]==true && FreedVpnService.running)
  retryNotifications.fail=false
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,retryToken,retryOp)["accepted"]==true)

  val failedToken="[\"cleanup-commit-owner\",815]";val failedOp="cleanup_operation_commit_815"
  context=seed(failedToken);context.storage.failNext=true
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,failedToken,failedOp)["accepted"]==false)
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,failedToken,failedOp)["accepted"]==true)

  val corruptToken="[\"cleanup-corrupt-owner\",816]"
  context=seed(corruptToken)
  (context.getSharedPreferences("freed_private_cleanup_receipt_v1",0) as MemoryPreferences).values["junk"]="corrupt"
  val untouched=context.storage.values.toMap()
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,corruptToken,"cleanup_operation_corrupt_816")["accepted"]==false)
  check(context.storage.values==untouched && FreedVpnService.running)

  val unknownToken="[\"cleanup-unknown-adult\",817]"
  context=seed(unknownToken)
  context.storage.values.remove("adult_domain_feed_domains")
  context.storage.values.remove("user_allowed_domains")
  context.storage.values["dns_guard_user_enabled"]="corrupt-retained-intent"
  val unknown=context.storage.values.filterKeys{!FreedRetainedAdultProtection.privateKey(it)}
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,unknownToken,"cleanup_operation_unknown_817")["accepted"]==true)
  check(context.storage.values==unknown && FreedVpnService.running)
  check(!context.storage.values.containsKey("adult_domain_feed_domains"))
  val stalePendingToken="[\"cleanup-old-stamp-owner\",820]"
  context=seed(stalePendingToken)
  FreedWebsiteRecoveryHandoff.pending=FreedWebsiteRecoveryHandoff.Stamp("[\"new-stamp-owner\",821]")
  val stalePendingBefore=context.storage.values.toMap()
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,stalePendingToken,"cleanup_stale_pending_820")["accepted"]==false)
  check(context.storage.values==stalePendingBefore)
  check(FreedWebsiteRecoveryHandoff.pending?.owner=="[\"new-stamp-owner\",821]")
  val transitionToken="[\"cleanup-in-progress-owner\",818]"
  context=seed(transitionToken)
  var transitionAttempted=false
  FreedAccessibilityService.cleanupHook={transitionAttempted=true;check(!FreedAppGroupStore.bindScope(context,"[\"next-owner\",819]"))}
  check(FreedAppGroupStore.clearPrivateRetainingAdult(context,transitionToken,"cleanup_transition_818")["accepted"]==true)
  check(transitionAttempted)
  FreedAccessibilityService.cleanupHook=null
  check(FreedAppGroupStore.bindScope(context,"[\"next-owner\",819]"))
  println("Actual Android retained helper/store: owner-fenced private authority deletion; exact/cold-rebind retry; stale/new owner; commit/notification failures; corrupt tombstone; unknown adult intent preserves installed consumer; adult DNS/feed/exceptions/protected namespace unchanged passed")
}
