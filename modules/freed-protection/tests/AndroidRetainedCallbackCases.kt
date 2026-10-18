package app.freed.protection

import android.app.NotificationManager
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

fun main() {
 val service=CallbackService();CallbackService.connected=service
 val ownerA="[\"callback-owner-A\",8110]";val ownerB="[\"callback-owner-B\",8111]"
 check(FreedAppGroupStore.bindScope(service,ownerA))
 service.services[android.content.Context.NOTIFICATION_SERVICE]=NotificationManager()
 service.storage.values["adult_domain_feed_domains"]="adult.example"
 service.storage.values["dns_guard_user_enabled"]=true
 service.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 check(service.storage.contains(CallbackService.LAST_FOREGROUND_PACKAGE))
 val cleanup=FreedAppGroupStore.clearPrivateRetainingAdult(service,ownerA,"callback_cleanup_8110")
 check(cleanup["accepted"]==true)
 val retained=service.storage.all
 val writes=service.storage.commits
 check(retained.keys.none(FreedRetainedAdultProtection::privateKey))
 // Exercise the actual later event and both lower writers, not a cleanup adapter's Boolean.
 SystemClock.now+=5_000
 service.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 service.trackForCase("org.reader",ownerA)
 service.closeForCase(ownerA)
 service.ensureForCase(ownerA)
 check(service.storage.all==retained && service.storage.commits==writes){"Actual later event/track/close/day writer recreated private keys after accepted cleanup: ${service.storage.all.keys.filter(FreedRetainedAdultProtection::privateKey)}"}
 check(FreedAppGroupStore.clearPrivateRetainingAdult(service,ownerA,"callback_cleanup_8110")["replay"]==true)
 service.onAccessibilityEvent(AccessibilityEvent("com.android.chrome"))
 check(service.browserLaunches==1){"Retained adult classifier must still run while private owner is suspended"}
 check(service.storage.all==retained && FreedVpnService.running)
 check(FreedAppGroupStore.bindScope(service,ownerB))
 SystemClock.now+=5_000
 service.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 val newOwner=service.storage.all;val newCommits=service.storage.commits
 check(newOwner[CallbackService.LAST_FOREGROUND_PACKAGE]=="org.reader")
 check(newOwner[CallbackService.LAST_FOREGROUND_ELAPSED_MS]==SystemClock.now)
 check(newOwner[CallbackService.APP_USAGE_PREFIX+"org.reader"]==null){"New owner cannot inherit old foreground elapsed time"}
 service.trackForCase("org.game",ownerA);service.closeForCase(ownerA);service.ensureForCase(ownerA)
 check(service.storage.all==newOwner && service.storage.commits==newCommits){"Stale original-owner work must not clear/write new owner state"}
 SystemClock.now+=1_000;service.closeForCase(ownerB)
 check(service.storage.values[CallbackService.APP_USAGE_PREFIX+"org.reader"]==1_000L)
 check(!service.storage.contains(CallbackService.LAST_FOREGROUND_PACKAGE))
 // Capture A at event entry, then bind B in an intervening OS adapter call.
 check(FreedAppGroupStore.bindScope(service,ownerA));service.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 val ownerC="[\"callback-owner-C\",8112]"
 var during:Map<String,Any?>?=null
 FreedFocusShieldRollout.callbackHook={FreedFocusShieldRollout.callbackHook=null;check(FreedAppGroupStore.bindScope(service,ownerC));service.storage.values[CallbackService.LAST_FOREGROUND_PACKAGE]="new-owner-current";service.storage.values[CallbackService.LAST_FOREGROUND_ELAPSED_MS]=SystemClock.now;during=service.storage.all}
 service.onAccessibilityEvent(AccessibilityEvent("org.game"))
 check(service.storage.all==during){"Callback captured for old scope must not rebind private writes mid-event"}
 // Without cleanup, a scope transition also cannot attribute the previous live interval to the new owner.
 val next=CallbackService();CallbackService.connected=next
 val first="[\"live-owner-first\",8113]";val second="[\"live-owner-second\",8114]"
 check(FreedAppGroupStore.bindScope(next,first));next.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 SystemClock.now+=4_000
 check(FreedAppGroupStore.bindScope(next,second));next.onAccessibilityEvent(AccessibilityEvent("org.game"))
 check(next.storage.values[CallbackService.APP_USAGE_PREFIX+"org.reader"]==null)
 check(next.storage.values[CallbackService.LAST_FOREGROUND_PACKAGE]=="org.game")
 val afterSwitch=next.storage.all;val afterSwitchCommits=next.storage.commits
 next.closeForCase(first);next.trackForCase("org.reader",first);next.ensureForCase(first)
 check(next.storage.all==afterSwitch && next.storage.commits==afterSwitchCommits)
 // Revalidate after an intervening native/OS policy lookup, before editor application.
 var newState:Map<String,Any?>?=null
 SystemClock.now+=1_000
 val third="[\"live-owner-third\",8115]"
 next.nextConfiguredHook={check(FreedAppGroupStore.bindScope(next,third));next.storage.values[CallbackService.LAST_FOREGROUND_PACKAGE]="new-target";next.storage.values[CallbackService.LAST_FOREGROUND_ELAPSED_MS]=SystemClock.now;next.storage.values[CallbackService.APP_USAGE_PREFIX+"org.game"]=999L;newState=next.storage.all}
 next.trackForCase("org.reader",second)
 check(next.storage.all==newState){"Old editor must not apply after native owner changes during policy lookup"}
 val suspended=next.storage.all;val suspendedCommits=next.storage.commits
 check(FreedAppGroupStore.suspendPrivateOperations())
 next.onAccessibilityEvent(AccessibilityEvent("org.reader"));next.trackForCase("org.reader",third);next.closeForCase(third);next.ensureForCase(third)
 check(next.storage.all==suspended && next.storage.commits==suspendedCommits)
 next.connectedCurrent=false
 check(FreedAppGroupStore.bindScope(next,third))
 val disconnected=next.storage.all;val disconnectedCommits=next.storage.commits
 next.trackForCase("org.reader",third);next.closeForCase(third);next.ensureForCase(third)
 check(next.storage.all==disconnected && next.storage.commits==disconnectedCommits)
 next.connectedCurrent=true
 check(FreedAppGroupStore.suspendPrivateOperations())
 val fourth="[\"null-capture-new-owner\",8116]"
 var afterNullCaptureBind:Map<String,Any?>?=null
 FreedFocusShieldRollout.callbackHook={FreedFocusShieldRollout.callbackHook=null;check(FreedAppGroupStore.bindScope(next,fourth));next.storage.values[CallbackService.LAST_FOREGROUND_PACKAGE]="new-owner-marker";next.storage.values[CallbackService.LAST_FOREGROUND_ELAPSED_MS]=SystemClock.now;afterNullCaptureBind=next.storage.all}
 next.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 check(next.storage.all==afterNullCaptureBind){"Unknown owner captured at callback entry cannot fall through to newly bound owner"}
 next.onAccessibilityEvent(AccessibilityEvent("org.reader"))
 SystemClock.now+=1_000
 val fifth="[\"close-lookup-new-owner\",8117]"
 var afterCloseLookupBind:Map<String,Any?>?=null
 next.nextConfiguredHook={check(FreedAppGroupStore.bindScope(next,fifth));next.storage.values[CallbackService.LAST_FOREGROUND_PACKAGE]="new-close-marker";next.storage.values[CallbackService.LAST_FOREGROUND_ELAPSED_MS]=SystemClock.now;afterCloseLookupBind=next.storage.all}
 next.closeForCase(fourth)
 check(next.storage.all==afterCloseLookupBind){"Close editor must not clear new owner markers after intervening owner change"}
 // Actual adult intent + event + actual launch publication member, independent of app owner tracking.
 next.storage.values["adult_domain_feed_domains"]="adult.example"
 check(FreedAdultProtectionState.setAccessibility(next,true))
 val adultConfigBefore=next.storage.getString("app_groups_configuration_v1",null)
 SystemClock.now+=5_000
 val noticesBefore=next.notices
 next.onAccessibilityEvent(AccessibilityEvent("com.android.chrome"))
 check(next.notices==noticesBefore+1){"Actual adult publication must remain available while intent is On"}
 val capturedAdult=FreedAdultProtectionState.callbackEpoch(next)
 check(FreedAdultProtectionState.setAccessibility(next,false))
 val offSnapshot=next.storage.all
 SystemClock.now+=5_000
 next.launchCaptured(capturedAdult)
 next.onAccessibilityEvent(AccessibilityEvent("com.android.chrome"))
 check(next.notices==noticesBefore+1 && next.storage.all==offSnapshot){"Old/off adult event must not publish"}
 check(next.storage.getString("app_groups_configuration_v1",null)==adultConfigBefore)
 check(FreedAdultProtectionState.setAccessibility(next,true))
 next.beforeClassify={check(FreedAdultProtectionState.setAccessibility(next,false))}
 next.onAccessibilityEvent(AccessibilityEvent("com.android.chrome"))
 check(next.notices==noticesBefore+1){"Off between event capture and classifier must suppress publication"}
 check(FreedAdultProtectionState.setAccessibility(next,true))
 SystemClock.now+=5_000
 next.onAccessibilityEvent(AccessibilityEvent("com.android.chrome"))
 check(next.notices==noticesBefore+2){"Adult-only repair must restore actual publication"}
 println("PASS actual intent/event/adult publication: On, Off, captured stale launch, Off during event, repair; existing owner/cleanup assertions retained")
 println("Actual retained accessibility callbacks: red path fixed; event/track/close/day after cleanup create zero private keys; replay stays exact; stale owner/work leaves newer state intact; explicit newer owner records own interval; adult classifier/DNS retained passed")
}
